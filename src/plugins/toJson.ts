import { Schema } from 'mongoose';

export default function toJSONPlugin(schema: Schema) {
	// Add a transform to all schemas
	schema.set('toJSON', {
		virtuals: true,
		versionKey: false,
		transform(_, ret) {
			ret.id = ret._id;
			delete ret._id;
		},
	});

	// Optional: apply same logic to .toObject if you use it
	schema.set('toObject', {
		virtuals: true,
		versionKey: false,
		transform(_, ret) {
			ret.id = ret._id;
			delete ret._id;
		},
	});
}
