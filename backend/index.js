import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get('/lookup', async (req, res) => {
  const { barcode } = req.query;
  if (!barcode) return res.status(400).json({ error: 'Missing barcode' });

  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  try {
    const tokenRes = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&scope=basic&client_id=${clientId}&client_secret=${clientSecret}`,
    });
    const tokenData = await tokenRes.json();

    const apiRes = await fetch('https://platform.fatsecret.com/rest/server.api', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `method=food.find_id_for_barcode&barcode=${barcode}&format=json`,
    });

    const foodData = await apiRes.json();
    res.json(foodData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from FatSecret' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
