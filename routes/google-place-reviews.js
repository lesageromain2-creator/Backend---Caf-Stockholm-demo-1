/**
 * GET /api/google-place-reviews?placeId=ChIJ...
 * Récupère les avis Google du lieu (Places API New) pour le carrousel.
 * Réponse : { success, rating, userRatingCount, reviews[], placeName }
 * Chaque review a : authorName, authorUri, authorPhotoUri, rating, text, relativePublishTimeDescription, googleMapsUri
 */

const express = require('express');
const router = express.Router();

const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';
const FIELDS = 'id,displayName,rating,userRatingCount,reviews,googleMapsLinks.reviewsUri';

router.get('/', async (req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = req.query.placeId || process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return res.status(400).json({
      success: false,
      error: 'Missing GOOGLE_PLACES_API_KEY or placeId. Set env GOOGLE_PLACES_API_KEY and pass placeId query or set GOOGLE_PLACE_ID.',
    });
  }

  try {
    const url = `${PLACES_API_BASE}/${encodeURIComponent(placeId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELDS,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Places API error:', response.status, errText);
      return res.status(response.status).json({
        success: false,
        error: 'Places API error',
        details: response.status === 403 ? 'Check API key and enable Places API (New).' : errText.slice(0, 200),
      });
    }

    const data = await response.json();

    const reviews = (data.reviews || []).map((r) => {
      const author = r.authorAttribution || {};
      const textObj = r.text || {};
      return {
        authorName: author.displayName || 'Avis Google',
        authorUri: author.uri || null,
        authorPhotoUri: author.photoUri || null,
        rating: typeof r.rating === 'number' ? r.rating : null,
        text: typeof textObj.text === 'string' ? textObj.text : (r.text && r.text.text) || '',
        relativePublishTimeDescription: r.relativePublishTimeDescription || '',
        googleMapsUri: r.googleMapsUri || null,
      };
    });

    // Meilleurs avis en premier (rating décroissant)
    reviews.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    res.json({
      success: true,
      placeName: data.displayName?.text || null,
      rating: data.rating ?? null,
      userRatingCount: data.userRatingCount ?? null,
      reviewsUri: data.googleMapsLinks?.reviewsUri || null,
      reviews,
    });
  } catch (err) {
    console.error('google-place-reviews error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
