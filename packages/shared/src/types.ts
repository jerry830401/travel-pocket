export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /**
   * URL of the card image: an uploaded cover (`/api/trips/{id}/cover?v=…`),
   * a static path, or "" for none.
   */
  coverImage: string;
}

export interface ItineraryItem {
  id: string;
  title: string;
  location: string;
  category: "food" | "transport" | "accommodation" | "sightseeing" | "other";
  startTime: string;
  endTime: string;
  description?: string | string[];
}

export interface ItineraryDay {
  id: string;
  day: number | string;
  date: string;
  items: ItineraryItem[];
}

export interface Shop {
  id: string;
  name: string;
  location: string;
  tags: string[];
  businessHours: string;
}

export interface InfoLink {
  label: string;
  url: string;
}

export interface InfoItem {
  id: string;
  title: string;
  icon: string;
  links: InfoLink[];
}
