import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get('/lookup-food-id', async (req, res) => {

  // Step 0: Check if the barcode query parameter is provided
  const { barcode } = req.query;
  console.log('Received request to /lookup');
  console.log('Query parameters:', req.query);


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

    if (!fatsecretRes.ok) {
      const text = await fatsecretRes.text();
      console.error('Unexpected response:', text);
      throw new Error(`HTTP ${fatsecretRes.status}: ${fatsecretRes.statusText}`);
    }
    const foodData = await fatsecretRes.json();
    console.log('FatSecret response:', foodData);

    res.json(foodData);
  } catch (err) {
    console.error('Error talking to FatSecret:', err);
    res.status(500).json({ error: 'Failed to fetch from FatSecret' });
  }
});

app.get('/food-details', async (req, res) => {
  const { food_id } = req.query;
  if (!food_id) {
    return res.status(400).json({ error: 'Missing food_id' });
  }

  try {
    // Step 1: Get access token using allowed scopes
    const tokenRes = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'basic food',
        client_id: process.env.FATSECRET_CLIENT_ID,
        client_secret: process.env.FATSECRET_CLIENT_SECRET,
      }),
    });

    const tokenText = await tokenRes.text();
    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch (parseError) {
      console.error('OAuth token parse error. Raw response:', tokenText);
      return res.status(502).json({ error: 'Invalid token response from FatSecret', raw: tokenText });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(500).json({ error: 'Token missing from FatSecret', details: tokenData });
    }

    // Step 2: Request food.get (no premium-only flags)
    const foodRes = await fetch(`https://platform.fatsecret.com/rest/v4/food.get?${new URLSearchParams({
      food_id,
    })}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let foodData;
    try {
      foodData = await foodRes.json();
    } catch (parseError) {
      const raw = await foodRes.text();
      console.error('FatSecret food.get returned non-JSON:', raw);
      return res.status(502).json({ error: 'Invalid response from FatSecret', raw });
    }

    res.json(foodData);

  } catch (err) {
    console.error('Error in /food-details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

