const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
app.use(cors());
app.use(express.json());

/* =========================
   PREVENTIVI
========================= */

// CREA PREVENTIVO
app.post("/quotes", async (req, res) => {
  try {
    const { client, items, ivaRate, description } = req.body;

    const subtotal = items.reduce((acc, i) => acc + i.total, 0);
    const ivaAmount = subtotal * (ivaRate / 100);
    const total = subtotal + ivaAmount;

    const quote = await prisma.quote.create({
      data: {
        client: {
          create: client,
        },
        subtotal,
        ivaRate,
        ivaAmount,
        total,
  description,
       items: {
  create: items.map(i => ({
    type: "materiale",
    name: i.name,
    qty: i.qty,
    price: i.price,
    total: i.total
  })),
},
      },
      include: { items: true, client: true },
    });

    res.json(quote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore creazione preventivo" });
  }
});

// LISTA PREVENTIVI
app.get("/quotes", async (req, res) => {
  try {
    const quotes = await prisma.quote.findMany({
      include: { client: true, items: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: "Errore lettura preventivi" });
  }
});

/* =========================
   MATERIALI (PREMENU)
========================= */

// GET materiali
app.get("/price-items", async (req, res) => {
  try {
    const items = await prisma.priceItem.findMany({
      orderBy: { name: "asc" },
    });

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore lettura materiali" });
  }
});

// CREA materiale
app.post("/price-items", async (req, res) => {
  try {
    const { name, price, unit } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Dati mancanti" });
    }

    const item = await prisma.priceItem.create({
      data: { name, price, unit },
    });

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore creazione materiale" });
  }
});

// DELETE materiale (utile dopo)
app.delete("/price-items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    await prisma.priceItem.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore eliminazione" });
  }
});

app.get("/quotes/:id/pdf", async (req, res) => {
  const id = parseInt(req.params.id);

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { client: true, items: true },
  });

  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=preventivo_${id}.pdf`
  );

  doc.pipe(res);

  // HEADER
  doc.fontSize(18).text("Preventivo Fabbro", { align: "center" });

  doc.moveDown();
  doc.fontSize(12).text(`Cliente: ${quote.client.name}`);
  doc.text(`Telefono: ${quote.client.phone || "-"}`);

  doc.moveDown();

  // RIGHE
  quote.items.forEach((item) => {
    doc.text(
      `${item.name} - ${item.qty} x €${item.price} = €${item.total}`
    );
  });

  doc.moveDown();

  doc.text(`Subtotale: €${quote.subtotal}`);
  doc.text(`IVA: €${quote.ivaAmount}`);
  doc.text(`Totale: €${quote.total}`);

  doc.end();
});

// DELETE PREVENTIVO
app.delete("/quotes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // elimina prima items
    await prisma.quoteItem.deleteMany({
      where: { quoteId: id },
    });

    // poi preventivo
    await prisma.quote.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore eliminazione" });
  }
});

// ELIMINA PREVENTIVO
app.delete("/quotes/:id", async (req, res) => {

  const id = Number(req.params.id);

  try {

    await prisma.quoteItem.deleteMany({
      where: {
        quoteId: id
      }
    });

    await prisma.quote.delete({
      where: {
        id
      }
    });

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Errore eliminazione"
    });

  }

});


// ❌ ELIMINA PREVENTIVO
app.delete("/quotes/:id", async (req, res) => {

  const id = Number(req.params.id);

  try {

    await prisma.quoteItem.deleteMany({
      where: {
        quoteId: id
      }
    });

    await prisma.quote.delete({
      where: {
        id
      }
    });

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Errore eliminazione"
    });

  }

});


// ==========================
// SETTINGS AZIENDA
// ==========================

// GET SETTINGS
app.get("/settings", async (req, res) => {

  try {

    const settings =
      await prisma.companySettings.findFirst();

    res.json(settings || {});

  } catch (err) {

    console.log(err);

    res
      .status(500)
      .json({
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

    res
      .status(500)
      .json({
        error: "Errore salvataggio settings"
      });
  }
});

/* =========================
   SERVER
========================= */

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
