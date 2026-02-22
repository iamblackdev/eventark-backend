import GoogleStrategy from 'passport-google-oidc';
import passport, { Profile } from 'passport';

const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || '4000'}`;

console.log('====backend', BACKEND_URL);

passport.use(
	'google',
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			callbackURL: `${BACKEND_URL}/api/auth/redirect/google`,
			scope: ['profile', 'email'],
		},
		(issuer: string, profile: Profile, done: (arg0: null, arg1: { googleId: string; email: string | undefined; name: string }) => void) => {
			const user = {
				googleId: profile.id,
				email: profile.emails?.[0]?.value,
				name: profile.displayName,
			};

			done(null, user);
		},
	),
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
	done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user: any, done) => {
	done(null, user);
});

export default passport;
