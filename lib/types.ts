export type Pass = {
  passId: string;
  key: string;
  name: string;
  participantType: string;
  firm: string;
  persons: number;
  mobile: string;
  email: string;
  checkedIn?: boolean;
  checkinTime?: string;
};

export type Stats = {
  registrations: number;
  persons: number;
  checkedIn: number;
  checkedInPersons: number;
};
