app.get('/lookup-food-id', async (req, res) => {
  const { barcode } = req.query;
  if (!barcode) return res.status(400).json({ error: 'Missing barcode' });

  try {
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


app.get('/food-details', async (req, res) => {
  const { food_id } = req.query;
  if (!food_id) return res.status(400).json({ error: 'Missing food_id' });

  try {
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

    const { access_token } = await tokenRes.json();

    const foodRes = await fetch(`https://platform.fatsecret.com/rest/v4/food.get?${new URLSearchParams({
      food_id,
      include_sub_categories: 'true',
      include_food_image: 'true',
      include_food_attributes: 'true',
    })}`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const foodData = await foodRes.json();
    res.json(foodData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching food details' });
  }
});
