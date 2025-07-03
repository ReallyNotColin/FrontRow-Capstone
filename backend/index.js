import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Function to Look up food by barcode, called by the frontend when a user submits a barcode in the search bar
// This endpoint will be called by the frontend to look up food information based on a barcode submitted by the user in the search bar
// NOTE: We should later change this to something like "lookup-by-barcode-ID" to avoid confusion with the other lookup endpoint (name, brand,etc.)
app.get('/lookup-food-id', async (req, res) => {
  const { barcode } = req.query;
  if (!barcode) return res.status(400).json({ error: 'Missing barcode' });

  try {
    // Step 1: Get OAuth token
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

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(500).json({ error: 'Failed to retrieve access token', details: tokenData });
    }

    // Step 2: Get food_id from barcode
    const idRes = await fetch('https://platform.fatsecret.com/rest/server.api', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        method: 'food.find_id_for_barcode',
        barcode,
        format: 'json',
      }),
    });

    const idData = await idRes.json();
    const food_id = idData.food_id;

    if (!food_id) {
      return res.status(404).json({ error: 'No food found for this barcode', details: idData });
    }

    // Step 3: Get full food details using food.get
    const foodRes = await fetch(`https://platform.fatsecret.com/rest/v4/food.get?${new URLSearchParams({
      food_id,
      include_sub_categories: 'true',
      include_food_image: 'true',
      include_food_attributes: 'true',
    })}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const foodData = await foodRes.json();

    // Step 4: Return only food.get response
    res.json(foodData);

  } catch (err) {
    console.error('Error in /lookup:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// // This endpoint will be called by a lookup endpoint from the backend to get detailed information about a food item based on its ID
// // This is used to get more detailed information about a food item, such as its nutritional information and allergen warnings 
// // NOTE: Per TOS, we can *never* save food data from fatsecret indefinitely. So we can only save the food_id. This means that for each time we want to display food data, we must search via a stored food_id each time.
// app.get('/food-details', async (req, res) => {
//   const { food_id } = req.query;
//   if (!food_id) return res.status(400).json({ error: 'Missing food_id' });

//   try {
//     // Get access token
//     const tokenRes = await fetch('https://oauth.fatsecret.com/connect/token', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//       body: new URLSearchParams({
//         grant_type: 'client_credentials',
//         scope: 'basic food',
//         client_id: process.env.FATSECRET_CLIENT_ID,
//         client_secret: process.env.FATSECRET_CLIENT_SECRET,
//       }),
//     });

//     const tokenData = await tokenRes.json();
//     const accessToken = tokenData.access_token;
//     if (!accessToken) return res.status(500).json({ error: 'Token failed', details: tokenData });

//     // Fetch the actual food data
//     const foodRes = await fetch(`https://platform.fatsecret.com/rest/v4/food.get?${new URLSearchParams({
//       food_id,
//       include_sub_categories: 'true',
//       include_food_image: 'true',
//       include_food_attributes: 'true',
//     })}`, {
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//       },
//     });

//     const foodData = await foodRes.json();
//     res.json(foodData);

//   } catch (err) {
//     console.error('Error fetching food details:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });


// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
