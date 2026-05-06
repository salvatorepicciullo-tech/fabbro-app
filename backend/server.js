const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const PDFDocument = require("pdfkit");

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

/* =========================================
   PREVENTIVI
========================================= */

// CREA PREVENTIVO
app.post("/quotes", async (req, res) => {

  try {

    const {
      client,
      items,
      ivaRate,
      description
    } = req.body;

    const subtotal = items.reduce(
      (acc, i) => acc + Number(i.total),
      0
    );

    const ivaAmount =
      subtotal * (ivaRate / 100);

    const total =
      subtotal + ivaAmount;

    // CLIENTE
    const savedClient =
      await prisma.client.create({
        data: client
      });

    // PREVENTIVO
    const quote =
      await prisma.quote.create({

        data: {

          clientId: savedClient.id,

          subtotal,
          ivaRate,
          ivaAmount,
          total,

          description,

          items: {
            create: items.map((i) => ({
              type: i.type || "material",
              name: i.name,
              qty: Number(i.qty),
              price: Number(i.price),
              total: Number(i.total)
            }))
          }
        },

        include: {
          client: true,
          items: true
        }
      });

    res.json(quote);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Errore creazione preventivo"
    });
  }
});

// LISTA PREVENTIVI
app.get("/quotes", async (req, res) => {

  try {

    const quotes =
      await prisma.quote.findMany({

        include: {
          client: true,
          items: true
        },

        orderBy: {
          createdAt: "desc"
        }
      });

    res.json(quotes);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Errore lettura preventivi"
    });
  }
});

// UPDATE PREVENTIVO
app.put("/quotes/:id", async (req, res) => {

  const id = Number(req.params.id);

  const {
    client,
    items,
    ivaRate,
    description
  } = req.body;

  try {

    // PREVENTIVO ESISTENTE
    const existingQuote =
      await prisma.quote.findUnique({

        where: {
          id
        },

        include: {
          client: true
        }
      });

    if (!existingQuote) {

      return res.status(404).json({
        error: "Preventivo non trovato"
      });
    }

    // UPDATE CLIENTE
    await prisma.client.update({

      where: {
        id: existingQuote.client.id
      },

      data: {

        name:
          client.name || "",

        companyName:
          client.companyName || "",

        contactName:
          client.contactName || "",

        vat:
          client.vat || "",

        fiscalCode:
          client.fiscalCode || "",

        sdi:
          client.sdi || "",

        pec:
          client.pec || "",

        phone:
          client.phone || "",

        email:
          client.email || "",

        address:
          client.address || ""
      }
    });

    // ELIMINA RIGHE VECCHIE
    await prisma.quoteItem.deleteMany({

      where: {
        quoteId: id
      }
    });

    // TOTALI
    const subtotal = items.reduce(
      (acc, i) =>
        acc + Number(i.total || 0),
      0
    );

    const ivaAmount =
      subtotal * (ivaRate / 100);

    const total =
      subtotal + ivaAmount;

    // UPDATE PREVENTIVO
    const updated =
      await prisma.quote.update({

        where: {
          id
        },

        data: {

          subtotal,
          ivaRate,
          ivaAmount,
          total,

          description,

          items: {

            create: items.map((i) => ({

              type:
                i.type || "material",

              name:
                i.name || "",

              qty:
                Number(i.qty || 0),

              price:
                Number(i.price || 0),

              total:
                Number(i.total || 0)
            }))
          }
        },

        include: {
          client: true,
          items: true
        }
      });

    res.json(updated);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Errore update preventivo"
    });
  }
});

// ELIMINA PREVENTIVO
app.delete("/quotes/:id", async (req, res) => {

  const id = Number(req.params.id);

  try {

    // trova preventivo
    const quote =
      await prisma.quote.findUnique({
        where: { id }
      });

    if (!quote) {

      return res.status(404).json({
        error: "Preventivo non trovato"
      });
    }

    // elimina righe collegate
    await prisma.quoteItem.deleteMany({

      where: {
        quoteId: id
      }
    });

    // elimina preventivo
    await prisma.quote.delete({

      where: {
        id
      }
    });

    res.json({
      success: true
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Errore eliminazione"
    });
  }
});



/* =========================================
   MATERIALI
========================================= */

// LISTA MATERIALI
app.get("/price-items", async (req, res) => {

  try {

    const items =
      await prisma.priceItem.findMany({

        orderBy: {
          name: "asc"
        }
      });

    res.json(items);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Errore lettura materiali"
    });
  }
});

// CREA MATERIALE
app.post("/price-items", async (req, res) => {

  try {

    const {
      name,
      price,
      unit
    } = req.body;

    if (!name || !price) {

      return res.status(400).json({
        error: "Dati mancanti"
      });
    }

    const item =
      await prisma.priceItem.create({

        data: {
          name,
          price: Number(price),
          unit
        }
      });

    res.json(item);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Errore creazione materiale"
    });
  }
});

// ELIMINA MATERIALE
app.delete("/price-items/:id", async (req, res) => {

  try {

    const id =
      Number(req.params.id);

    await prisma.priceItem.delete({
      where: {
        id
      }
    });

    res.json({
      success: true
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Errore eliminazione materiale"
    });
  }
});

/* =========================================
   SETTINGS AZIENDA
========================================= */

// GET SETTINGS
app.get("/settings", async (req, res) => {

  try {

    const settings =
      await prisma.companySettings.findFirst();

    res.json(settings || {});

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Errore lettura settings"
    });
  }
});

// SAVE SETTINGS
app.post("/settings", async (req, res) => {

  try {

    const existing =
      await prisma.companySettings.findFirst();

    let settings;

    if (existing) {

      settings =
        await prisma.companySettings.update({

          where: {
            id: existing.id
          },

          data: req.body
        });

    } else {

      settings =
        await prisma.companySettings.create({
          data: req.body
        });
    }

    res.json(settings);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Errore salvataggio settings"
    });
  }
});

/* =========================================
   PDF PREVENTIVO
========================================= */

app.get("/quotes/:id/pdf", async (req, res) => {

  try {

    const id =
      Number(req.params.id);

    const quote =
      await prisma.quote.findUnique({

        where: {
          id
        },

        include: {
          client: true,
          items: true
        }
      });

    const settings =
      await prisma.companySettings.findFirst();

    if (!quote) {

      return res
        .status(404)
        .send("Preventivo non trovato");
    }

    const doc =
      new PDFDocument({
        margin: 50
      });

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename=preventivo-${id}.pdf`
    );

    doc.pipe(res);

    // HEADER
    doc
      .fontSize(24)
      .text(
        settings?.companyName ||
        "Preventivo",
        {
          align: "center"
        }
      );

    doc.moveDown();

    // DATI AZIENDA
    doc
      .fontSize(11)
      .text(
        `Titolare: ${settings?.owner || ""}`
      );

    doc.text(
      `P.IVA: ${settings?.vat || ""}`
    );

    doc.text(
      `SDI: ${settings?.sdi || ""}`
    );

    doc.text(
      `PEC: ${settings?.pec || ""}`
    );

    doc.text(
      `${settings?.address || ""}`
    );

    doc.text(
      `${settings?.city || ""}`
    );

    doc.text(
      `Tel: ${settings?.phone || ""}`
    );

    doc.text(
      `${settings?.email || ""}`
    );

    doc.moveDown(2);

    // CLIENTE
    doc
      .fontSize(18)
      .text("Cliente");

    doc
      .fontSize(12)
      .text(
        quote.client.companyName ||
        quote.client.name ||
        ""
      );

    if (quote.client.contactName) {
      doc.text(
        `Referente: ${quote.client.contactName}`
      );
    }

    if (quote.client.vat) {
      doc.text(
        `P.IVA: ${quote.client.vat}`
      );
    }

    if (quote.client.fiscalCode) {
      doc.text(
        `CF: ${quote.client.fiscalCode}`
      );
    }

    if (quote.client.sdi) {
      doc.text(
        `SDI: ${quote.client.sdi}`
      );
    }

    if (quote.client.pec) {
      doc.text(
        `PEC: ${quote.client.pec}`
      );
    }

    doc.text(
      quote.client.address || ""
    );

    doc.text(
      quote.client.phone || ""
    );

    doc.text(
      quote.client.email || ""
    );

    doc.moveDown();

    // DESCRIZIONE
    if (quote.description) {

      doc
        .fontSize(14)
        .text("Descrizione lavoro");

      doc
        .fontSize(11)
        .text(quote.description);

      doc.moveDown();
    }

    // RIGHE
    doc
      .fontSize(16)
      .text("Materiali / Lavorazioni");

    doc.moveDown();

    quote.items.forEach((item) => {

      doc
        .fontSize(11)
        .text(
          `${item.name} | ${item.qty} x €${item.price} = €${item.total}`
        );
    });

    doc.moveDown(2);

    // TOTALI
    doc
      .fontSize(14)
      .text(
        `Subtotale: € ${quote.subtotal.toFixed(2)}`
      );

    doc.text(
      `IVA: € ${quote.ivaAmount.toFixed(2)}`
    );

    doc
      .fontSize(20)
      .text(
        `TOTALE: € ${quote.total.toFixed(2)}`,
        {
          align: "right"
        }
      );

    doc.moveDown(3);

    doc
      .fontSize(10)
      .text(
        "Firma cliente _____________________",
        {
          align: "right"
        }
      );

    doc.end();

  } catch (err) {

    console.log(err);

    res
      .status(500)
      .send("Errore PDF");
  }
});




/* =========================================
   SERVER
========================================= */

const PORT =
  process.env.PORT || 3001;

app.listen(PORT, () => {

  console.log(
    "Server running on port " + PORT
  );
});
