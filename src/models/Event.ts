import { Schema, model } from 'mongoose';
import { EventType } from '../types';
import toJSONPlugin from '../plugins/toJson';
import { handleEventCascadeDelete } from '../helpers';

const AnonymousMessageSchema = new Schema(
	{
		message: { type: String, required: true },
		eventId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Event',
		},
	},
	{ timestamps: true }
);
const WishListItemSchema = new Schema(
	{
		product_title: { type: String, required: true },
		estimate: { type: Number, required: true, default: 0 },
		qty: { type: Number, required: true, default: 0 },
		total: { type: Number, required: true, default: 0 },
		importance: { type: Number, required: true, default: 0 },
		image: { type: String },
		eventId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Event',
		},
		userId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		contributors: [{ name: String, amount: Number, date: Date }],
		total_contributions: { type: Number, default: 0 },
	},
	{ timestamps: true }
);

export const PartyDetailsSchema = new Schema(
	{
		title: { type: String },
		date: { type: Date },
		location: {
			address: { type: String, required: true },
			lat: { type: Number, required: true },
			lng: { type: Number, required: true },
		},
		information: { type: String },
		userId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		guests: [{ name: String, bring_along: String, date: String }],
	},
	{ timestamps: true }
);

const EventSchema = new Schema<EventType>(
	{
		tips: { type: Number, default: 0 },
		celebrant_name: { type: String, required: true },
		title: { type: String, required: true },
		date: { type: Date, required: true },
		images: [{ type: String }],
		is_celebrant: { type: Boolean, required: true },
		grateful_words: { type: String },
		slug: { type: String },
		// cash_gift: { type: Boolean, required: true },
		having_party: { type: Boolean, required: true },
		wish_list: [{ type: Schema.Types.ObjectId, ref: 'WishList' }],
		party_details: { type: Schema.Types.ObjectId, ref: 'EventParty' },
		userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
		messages: [{ type: Schema.Types.ObjectId, ref: 'AnonymousMessage' }],
	},
	{ timestamps: true }
);

WishListItemSchema.plugin(toJSONPlugin);
PartyDetailsSchema.plugin(toJSONPlugin);
EventSchema.plugin(toJSONPlugin);
AnonymousMessageSchema.plugin(toJSONPlugin);

EventSchema.pre('save', function (next) {
	if (this.isModified('celebrant_name') || this.isModified('title')) {
		this.slug = `${this.id} ${this.celebrant_name || ''} ${this.title}`.split(' ').join('-');
	}
	next();
});

EventSchema.pre('findOneAndDelete', async function (next) {
	const event = await this.model.findOne(this.getFilter());
	try {
		await handleEventCascadeDelete(event);
		next();
	} catch (err: any) {
		next(err);
	}
});

const AnonymousMessageModel = model('AnonymousMessage', AnonymousMessageSchema);
const WishListModel = model('WishList', WishListItemSchema);
const PartyModel = model('EventParty', PartyDetailsSchema);
export { WishListModel, PartyModel, AnonymousMessageModel };

export default model('Event', EventSchema);
