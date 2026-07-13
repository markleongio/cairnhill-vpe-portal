// routes/public.js
// Unauthenticated routes reachable without login — currently just the
// published-agenda view used by the QR code on the print page. Deliberately
// kept separate from routes/meetings.js (which requires auth) so it's easy
// to audit exactly what's exposed to the public at a glance.
const express = require('express');
const meetingsRouter = require('./meetings');

const router = express.Router();

router.get('/meetings/:id', async (req, res) => {
  try {
    const detail = await meetingsRouter.getMeetingFullDetail(req.params.id);
    if (!detail || detail.status !== 'published') {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json(detail);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
