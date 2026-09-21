export interface TimetableSlot {
  time: string;
  subject_code: string;
  subject_name: string;
  faculty: string;
  type: string;
  room: string;
}

export interface TimetableData {
  [day: string]: TimetableSlot[];
}
