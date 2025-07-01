import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get('/lookup', async (req, res) => {

  // Step 0: Check if the barcode query parameter is provided
  const { barcode } = req.query;
  console.log('Received request to /lookup');
  console.log('Query parameters:', req.query);
  logger.info('Received barcode:', barcode);
  
  if (!barcode) return res.status(400).json({ error: 'Missing barcode' });

  // Step 1: Get access token from FatSecret
  try {
    // Fetch access token from FatSecret, using the client credentials that we'll provide in the .env file to the render server
    const tokenRes = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'basic barcode',
        client_id: process.env.FATSECRET_CLIENT_ID,
        client_secret: process.env.FATSECRET_CLIENT_SECRET,
      }),
    });

    // Check if token request was successful
    const tokenData = await tokenRes.json();
    console.log('Token data:', tokenData);

    // If the token request failed, return an error
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'Failed to retrieve access token', tokenData });
    }

    // Step 2: Make FatSecret request
    const fatsecretRes = await fetch('https://platform.fatsecret.com/rest/server.api', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        method: 'food.find_id_for_barcode',
        barcode,
        format: 'json',
      }),
    });

    const foodData = await fatsecretRes.json();

    res.json(foodData);
  } catch (err) {
    console.error('Error talking to FatSecret:', err);
    res.status(500).json({ error: 'Failed to fetch from FatSecret' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
