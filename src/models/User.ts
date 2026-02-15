import { Schema, model } from 'mongoose';
import { genSalt, hash, compare } from 'bcryptjs';
import { UserSchemaType } from '../types';
import toJSONPlugin from '../plugins/toJson';

const UserSchema = new Schema<UserSchemaType>(
	{
		email: { type: String, required: true },
		first_name: { type: String, required: true },
		googleId: { type: String },
		last_name: { type: String, required: true },
		name: { type: String },
		password: { type: String, required: true, select: false },
		email_verified: { type: Boolean, default: false },
		email_verified_at: { type: Date },
		gender: { type: String },
		dob: { type: Date },
		passwordReset: {
			code: { type: String },
			expiresAt: { type: Date },
		},
	},
	{
		timestamps: true,
	},
);

const OtpCodeSchema = new Schema(
	{
		email: { type: String, required: true, unique: true },
		code: { type: String, required: true },
		expiresAt: { type: Date, required: true },
	},
	{ timestamps: true },
);

UserSchema.pre('save', function (next) {
	if (this.isModified('first_name') || this.isModified('last_name')) {
		this.name = `${this.first_name || ''} ${this.last_name}`.trim();
	}
	next();
});

UserSchema.pre('findOneAndUpdate', async function (next) {
	const update = this.getUpdate() as any;

	// Use $set if it's a nested update
	const $set = update.$set || update;

	if ($set.first_name || $set.last_name) {
		// Get current doc values
		const doc = await this.model.findOne(this.getQuery());

		const first_name = $set.first_name ?? doc?.first_name;
		const last_name = $set.last_name ?? doc?.last_name;

		$set.name = `${first_name || ''} ${last_name || ''}`.trim();

		// Apply update back
		if (update.$set) {
			update.$set = $set;
		} else {
			this.setUpdate($set);
		}
	}

	next();
});

UserSchema.pre('save', async function (next) {
	if (!this.isModified('password')) return next();
	const salt = await genSalt(10);
	this.password = await hash(this.password, salt);
	next();
});

UserSchema.methods.matchPassword = function (enteredPassword: string) {
	return compare(enteredPassword, this.password);
};

UserSchema.plugin(toJSONPlugin);

const OTPModel = model('OtpCode', OtpCodeSchema);
export { OTPModel };
export default model('User', UserSchema);
