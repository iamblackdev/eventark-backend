export interface userPayloadType {
	email: string;
	password: string;
	first_name: string;
	last_name: string;
}

export interface UserSchemaType extends userPayloadType {
	name?: string;
	email_verified: boolean;
	email_verified_at: Date;
	gender: string;
	dob: Date;
	passwordReset: any;
	matchPassword: (enteredPassword: string) => Promise<boolean>;
}

export interface wishListItem {
	product_title: string;
	estimate: number;
	qty: number;
	total: number;
	importance: number;
	image?: File;
}

export interface partyDetailsType {
	title?: string;
	date?: string;
	time?: string;
	location?: {
		address: string;
		lat: number;
		lng: number;
	};
	items?: string[];
	information?: string;
}

export interface EventType {
	tips: number;
	userId: any;
	celebrant_name: string;
	title: string;
	date: Date;
	images: string[];
	is_celebrant: boolean;
	grateful_words: string;
	slug: string;
	// airtime: {
	// 	network: string;
	// 	phone: string;
	// };
	cash_gift: boolean;
	having_party: boolean;
	wish_list: wishListItem[];
	party_details: partyDetailsType;
	messages: any;
}
