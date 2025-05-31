import { model, Schema } from 'mongoose';
import toJSONPlugin from '../plugins/toJson';

const NotificationSchema = new Schema(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
		message: { type: String, required: true },
	},
	{ timestamps: true }
);
NotificationSchema.plugin(toJSONPlugin);

const NotificationModel = model('Notification', NotificationSchema);
export { NotificationModel };
