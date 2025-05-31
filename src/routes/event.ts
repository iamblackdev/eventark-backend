import { Request, Router } from 'express';
import auth from '../middleware/auth';
import Joi from 'joi';
import multer from 'multer';
import { uploadToCloudinary } from '../helpers';
import Event, { PartyModel, WishListModel, AnonymousMessageModel } from '../models/Event';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { NotificationModel } from '../models/Notification';
dayjs.extend(customParseFormat);

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Create event
router.post('/', auth, upload.any(), async (req: Request, res: any) => {
	const session = await mongoose.startSession();

	session.startTransaction();

	try {
		const body = req.body;
		const files = req.files as Express.Multer.File[];

		// uploading event images to cloudinary
		const eventImgs = files.filter((f) => f.fieldname.startsWith('images['));
		const uploadedTopImages = await Promise.all(eventImgs.map((f) => uploadToCloudinary(f.buffer, f.originalname)));

		// uploading whislist items with image to cloudinary
		const wishListImages: Record<string, string> = {};
		const itemFiles = files.filter((f) => f.fieldname.startsWith('wish_list['));
		for (const file of itemFiles) {
			const url = await uploadToCloudinary(file.buffer, file.originalname);
			wishListImages[file.fieldname] = url;
		}

		const result = {
			...body,
			images: uploadedTopImages,
		};

		let party: any;

		if (result?.party_details?.title) {
			const partyDateTime = dayjs(`${result?.party_details?.date} ${result?.party_details?.time}`, 'DD-MM-YYYY HH:mm', true).toDate();
			party = new PartyModel({
				date: partyDateTime,
				title: result?.party_details?.title,
				information: result?.party_details?.information,
				userId: req?.user?.id,
				location: result?.party_details?.location,
			});

			await party.save({ session });
		}

		const eventData: Record<string, any> = {
			celebrant_name: result.celebrant_name,
			date: dayjs(result.date).toDate(),
			grateful_words: result.grateful_words,
			having_party: result.having_party,
			images: result.images,
			is_celebrant: result.is_celebrant,
			title: result.title,
			userId: req.user?.id,
		};

		if (party?.id) eventData.party_details = party.id;

		const event = new Event(eventData);

		await event.save({ session });

		// reconstructiong the body object
		const wish_list: any[] = [];
		let index = 0;
		while (body[`wish_list[${index}]product_title`] !== undefined) {
			wish_list.push({
				eventId: event.id,
				userId: req.user?.id,
				product_title: body[`wish_list[${index}]product_title`],
				estimate: body[`wish_list[${index}]estimate`],
				qty: body[`wish_list[${index}]qty`],
				total: body[`wish_list[${index}]total`],
				importance: body[`wish_list[${index}]importance`],
				image: wishListImages[`wish_list[${index}]image`] || null,
			});
			index++;
		}

		const wishlists = await WishListModel.insertMany(wish_list, { session });

		const eventCreated = await Event.findByIdAndUpdate(
			event.id,
			{
				$push: {
					wish_list: wishlists.map((w) => w._id),
				},
			},
			{ new: true }
		)
			.select('-userId')
			.populate('wish_list', '-userId')
			.populate('party_details', '-userId')
			.session(session);

		await session.commitTransaction();

		return res.status(200).json({ data: eventCreated });
	} catch (error) {
		await session.abortTransaction();
		throw error;
	} finally {
		session.endSession();
	}
});

// add guest to party
router.post('/party/:partyId/guest', auth, async (req: Request, res: any) => {
	const partyid = req.params.partyId;
	const isObjectId = mongoose.Types.ObjectId.isValid(partyid);

	if (!isObjectId) return res.status(400).json({ message: 'Party Invalid' });

	const { error } = validateGuestDetails({ name: req.body.name });

	if (error) return res.status(400).json({ message: error.message });

	await PartyModel.findByIdAndUpdate(
		partyid,
		{
			$push: {
				guests: {
					name: req.body.name,
					bring_along: req.body.bring_along,
					date: dayjs().toDate(),
				},
			},
		},
		{ new: true }
	);
	return res.status(200).json({ message: "You've been added to the guest list" });
});

// Post annonymous message for event
router.post('/:eventId/message', auth, async (req: Request, res: any) => {
	const { error } = validateMessage(req.body?.message);
	if (error) return res.status(400).json({ message: error.message });

	const session = await mongoose.startSession();

	try {
		const eventid = req.params.eventId;
		const isObjectId = mongoose.Types.ObjectId.isValid(eventid);

		if (!isObjectId) return res.status(400).json({ message: 'Invalid event' });

		session.startTransaction();
		const event = await Event.findById(eventid).session(session);

		if (!event) res.status(400).json({ message: 'Invalid event' });

		const message = new AnonymousMessageModel({
			message: req.body.message,
			eventId: eventid,
		});

		await message.save({ session });

		const notification = new NotificationModel({
			eventId: eventid,
			userId: req.user?.id,
			message: 'You have a new secret message.',
		});
		await notification.save({ session });

		await Event.findByIdAndUpdate(eventid, {
			$push: { messages: message._id },
		}).session(session);

		await session.commitTransaction();

		return res.status(200).send({ message: 'Message Sent Successfully' });
	} catch (error) {
		await session.abortTransaction();
		throw error;
	} finally {
		session.endSession();
	}
});

// delete anonymous message
router.delete('/message/:messageId', auth, async (req: Request, res: any) => {
	const messageId = req.params.messageId;

	const session = await mongoose.startSession();
	try {
		session.startTransaction();

		const message = await AnonymousMessageModel.findOneAndDelete({ _id: messageId }).session(session);

		await Event.findByIdAndUpdate(message?.eventId, {
			$pull: { messages: messageId },
		}).session(session);

		await session.commitTransaction();

		return res?.json({ message: 'Message Deleted' });
	} catch (err) {
		await session.abortTransaction();
		throw err;
	} finally {
		session.endSession();
	}
});

// get event by slug
router.get('/slug/:eventslug', async (req: Request, res: any) => {
	const identifier = req.params.eventslug;

	const query: any = { slug: identifier };

	const event = await Event.findOne(query)
		.select(['-userId', '-messages', '-tips'])
		.populate('wish_list', ['-userId', '-contributors'])
		.populate('party_details', ['-userId', '-guests']);

	if (!event) return res.status(404).json({ message: 'Event not found' });

	res.status(200).json({ data: event });
});

// get event by id
router.get('/id/:id', auth, async (req: Request, res: any) => {
	const identifier = req.params.id;

	// Check if it's a valid MongoDB ObjectId
	const isValidObjectId = mongoose.Types.ObjectId.isValid(identifier);

	if (!isValidObjectId) return res.status(404).json({ message: 'Event not found' });

	const event = await Event.findOne({ _id: identifier, userId: req.user!.id })
		.select('-userId')
		.populate('wish_list', '-userId')
		.populate({
			path: 'messages',
			select: '-eventId',
			options: { sort: { createdAt: -1 } },
		})
		.populate('party_details', ['-userId']);

	if (!event) return res.status(404).json({ message: 'Event not found' });

	res.status(200).json({ data: event });
});

// get user events
router.get('/', auth, async (req: Request, res: any) => {
	const event = await Event.find({ userId: req.user?.id })
		.select('-userId')
		.populate('wish_list', '-userId')
		.populate('messages', '-eventId')
		.populate('party_details', '-userId')
		.sort({ createdAt: -1 });

	res.status(200).json({ data: event });
});

const validateMessage = (message: string) => {
	const schema = Joi.string().required().min(6);
	return schema.validate(message);
};

const validateGuestDetails = (val: Record<string, string>) => {
	const schema = Joi.object({
		name: Joi.string().required().min(3),
	});
	return schema.validate(val);
};

export default router;
