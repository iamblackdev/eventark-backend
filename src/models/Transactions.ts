import { model, Schema } from 'mongoose';
import toJSONPlugin from '../plugins/toJson';

const ReceivedTransactionSchema = new Schema(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		amount: { type: Number, required: true },
		title: { type: String, required: true },
		reference: { type: String, required: true, unique: true },
		from: { type: String, default: 'Anonymous' },
		type: { type: String, enum: ['Tip', 'Contribution'], required: true },
		status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
		metadata: Object,
	},
	{ timestamps: true }
);

const WithdrawTransactionSchema = new Schema(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		amount: { type: Number, required: true },
		amountWithdrawn: { type: Number, required: true },
		title: { type: String, required: true },
		reference: { type: String, required: true, unique: true },
		status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
		metadata: Object,
	},
	{ timestamps: true }
);

ReceivedTransactionSchema.plugin(toJSONPlugin);
WithdrawTransactionSchema.plugin(toJSONPlugin);

const ReceivedTransactionModel = model('ReceivedTransaction', ReceivedTransactionSchema);
const WithdrawTransactionModel = model('WithdrawTransaction', WithdrawTransactionSchema);

export { WithdrawTransactionModel, ReceivedTransactionModel };
