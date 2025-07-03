import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get('/lookup-food-id', async (req, res) => {
  const { barcode } = req.query;
  if (!barcode) return res.status(400).json({ error: 'Missing barcode' });

  try {
    const tokenRes = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'basic barcode food',
        client_id: process.env.FATSECRET_CLIENT_ID,
        client_secret: process.env.FATSECRET_CLIENT_SECRET,
      }),
    });

    const { access_token } = await tokenRes.json();

    const idRes = await fetch('https://platform.fatsecret.com/rest/server.api', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        method: 'food.find_id_for_barcode',
        barcode,
        format: 'json',
      }),
    });

    const idData = await idRes.json();
    res.json({ food_id: idData.food_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching food_id' });
  }
});


