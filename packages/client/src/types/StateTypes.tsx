import * as SigninDialog from 'components/Signin';

import {
  SigninErrors,
  TeacherRecord,
  TeacherCredentials
} from '@celluloid/commons';

export type User = TeacherRecord;

export interface SigninState {
  loading: boolean;
  dialog: SigninDialog.SigninState;
  errors: SigninErrors;
  credentials?: TeacherCredentials;
}

export interface AppState {
  user?: User;
  signin: SigninState;
}