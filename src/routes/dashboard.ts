import { Request, Router } from 'express';
import auth from '../middleware/auth';
import dayjs from 'dayjs';
import Event from '../models/Event';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrAfter);

const router = Router();
// dashboard
router.get('/', auth, async (req: Request, res: any) => {
	try {
		const userId = req.user?.id;

		// 1. Get all events for the user
		const events = await Event.find({ userId }).populate('wish_list').populate('party_details');

		const total_events = events.length;

		// 2. Count all wishlist items across all events
		const total_gifts = events.reduce((sum, event) => {
			return sum + (event.wish_list?.length || 0);
		}, 0);

		// 3. Sum tips from all events
		const total_tips = events.reduce((sum, event) => {
			return sum + (event.tips || 0);
		}, 0);

		// 4. Get today's date
		const today = dayjs();

		// 5. Filter for active events
		const active_events = events.filter((event) => {
			// Parse event.date (format: "DD-MM") into a real date with this year
			const eventDate = dayjs(event.date);

			const partyDate = event.party_details?.date ? dayjs(event.party_details.date) : null;

			// Check if either eventDate or partyDate is >= today
			return eventDate.isSameOrAfter(today, 'day') || (partyDate && partyDate.isSameOrAfter(today, 'day'));
		});

		res.json({
			data: {
				total_events,
				total_gifts,
				total_tips,
				active_events,
			},
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ data: { message: 'Failed to get dashboard summary' } });
	}
});

export default router;
