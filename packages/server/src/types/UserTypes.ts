import {
  TeacherRecord,
  // StudentRecord,
  // UserRecord
} from '@celluloid/commons';

export interface TeacherServerRecord extends TeacherRecord {
  code: string;
  codeExpiresAt: Date;
  confirmed: true;
  password: string;
}