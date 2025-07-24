import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Get Food ID from barcode endpoint
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

    // Step 2: Make FatSecret request for food ID using the barcode
      const fatsecretRes = await fetch(`https://platform.fatsecret.com/rest/food/barcode/find-by-id/v1?barcode=${encodeURIComponent(barcode)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!fatsecretRes.ok) {
      const text = await fatsecretRes.text();
      console.error('Unexpected response:', text);
      throw new Error(`HTTP ${fatsecretRes.status}: ${fatsecretRes.statusText}`);
    }
    const foodID = await fatsecretRes.json();
    console.log('FatSecret response:', foodID);

    res.json(foodID);
  } catch (err) {
    console.error('Error talking to FatSecret:', err);
    res.status(500).json({ error: 'Failed to fetch from FatSecret' });
  }
}); // End of Get Food ID from barcode endpoint

// Food details endpoint
app.get('/food-details', async (req, res) => {
  // Step 0: Check if the food_id query parameter is provided
  const { food_id } = req.query;
  if (!food_id) {
    return res.status(400).json({ error: 'Missing food_id' });
  }

  try {
    // Step 1: Get access token using allowed scopes
    const tokenRes2 = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'premier',
        client_id: process.env.FATSECRET_CLIENT_ID,
        client_secret: process.env.FATSECRET_CLIENT_SECRET,
      }),
    });

    // NOTE: constants should be function scoped, so we potentially don't need to redefine them as "token2" or something like that. need to check
    const tokenData2 = await tokenRes2.json();
    //console.log('Token2 data:', tokenData2);

    if (!tokenData2.access_token) {
      return res.status(500).json({ error: 'Failed to retrieve access token', tokenData2 });
    }
    // Step 2: Make FatSecret request for food details using the food_id
    // NOTE: fatsecret recommends using a URL method instead of a POST method for this request, but this works fine for now
    const foodDataRes = await fetch('https://platform.fatsecret.com/rest/server.api', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData2.access_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      method: 'food.get.v4',
      food_id,
      include_sub_categories: 'true', // get names of all sub categories associated with the food
      include_food_attributes: 'true', // get allergens 
      format: 'json',
    }),
    });


    const foodData = await foodDataRes.json()
    console.log('Food details response:', foodData);
    res.json(foodData);

  } catch (err) {
    console.error('Error in /food-details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}); // End of Food details endpoint

/*========================================================================================= */

// Autocomplete endpoint
app.get('/autocomplete', async (req, res) => {
  // Step 0: Check if the expression query parameter is provided
  const { expression } = req.query;
  if (!expression) {
    return res.status(400).json({ error: 'Missing search expression' });
  }

  // Step 1: Get access token using allowed scopes
  try {
    const tokenRes = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'premier', 
        client_id: process.env.FATSECRET_CLIENT_ID,
        client_secret: process.env.FATSECRET_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();

    // Step 2: Call fatsecret API for autocomplete suggestions
    // NOTE: fatsecret recommends using a URL method instead of a POST method for this request, but this works fine for now
    const autocompleteRes = await fetch('https://platform.fatsecret.com/rest/server.api', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      method: 'foods.autocomplete.v2',
      expression,
      format: 'json',
      //max_results: '10', // Limit results to 10 for performance 
    }),
    });

    const data = await autocompleteRes.json();

    console.log('Backend: Autocomplete response:', data);
    res.json(data);
  } catch (err) {
    console.error('Autocomplete error:', err);
    res.status(500).json({ error: 'Failed to fetch autocomplete suggestions' });
  }
}); // End of Autocomplete endpoint



// Helper function to fetch food details using food_id
async function fetchFoodDetails(food_id, accessToken) {
  const foodDataRes = await fetch('https://platform.fatsecret.com/rest/server.api', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      method: 'food.get.v4',
      food_id,
      include_sub_categories: 'true', // get names of all sub categories associated with the food
      include_food_attributes: 'true', // get allergens 
      format: 'json',
    }),
  });

  if (!foodDataRes.ok) {
    const errorText = await foodDataRes.text();
    throw new Error(`FatSecret food.get.v4 failed: ${errorText}`);
  }

  const data = await foodDataRes.json();
  return data;
}

// Revised /search-food-entry endpoint
app.get('/search-food-entry', async (req, res) => {
  const { name } = req.query;

  console.log('Received request to /search-food-entry');
  console.log('Query parameters:', req.query);

  if (!name) {
    return res.status(400).json({ error: 'Missing food name' });
  }

  try {
    // Step 1: Get access token for search and details
    const tokenRes3 = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'premier',
        client_id: process.env.FATSECRET_CLIENT_ID,
        client_secret: process.env.FATSECRET_CLIENT_SECRET,
      }),
    });

    const tokenData3 = await tokenRes3.json();
    if (!tokenData3.access_token) {
      return res.status(500).json({ error: 'Failed to retrieve access token', tokenData3 });
    }

    console.log('Access token for food.search:', tokenData3.access_token);

    // Step 2: Search for the food entry
    const searchRes = await fetch('https://platform.fatsecret.com/rest/server.api', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData3.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        method: 'foods.search',
        search_expression: name,
        format: 'json',
      }),
    });

    const searchData = await searchRes.json();
    console.log('food.search response:', searchData);

    const firstFood = searchData?.foods?.food?.[0];
    console.log('Food.Search: First food entry:', firstFood);

    if (!firstFood?.food_id) {
      return res.status(404).json({ error: 'No matching food found' });
    }

    // Step 3: Get food details directly
    const foodDetails = await fetchFoodDetails(firstFood.food_id, tokenData3.access_token);
    res.json(foodDetails);

  } catch (err) {
    console.error('Error in /search-food-entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

