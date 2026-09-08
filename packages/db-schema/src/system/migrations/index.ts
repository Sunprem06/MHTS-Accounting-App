import type { Migration } from 'kysely/migration';
import * as m001Init from './001_init';
import * as m002CompanyAccessKeyWrap from './002_company_access_key_wrap';
import * as m003CompanyRecoveryKey from './003_company_recovery_key';
import * as m004PerCompanyCredentialsAndLockout from './004_per_company_credentials_and_lockout';
import * as m005SecurityPolicy from './005_security_policy';
import * as m006AppPreference from './006_app_preference';
import * as m007LicenseActivation from './007_license_activation';
import * as m008GstRegistrationType from './008_gst_registration_type';
import * as m009DemoAndTrial from './009_demo_and_trial';

export const migrations: Record<string, Migration> = {
  '001_init': m001Init,
  '002_company_access_key_wrap': m002CompanyAccessKeyWrap,
  '003_company_recovery_key': m003CompanyRecoveryKey,
  '004_per_company_credentials_and_lockout': m004PerCompanyCredentialsAndLockout,
  '005_security_policy': m005SecurityPolicy,
  '006_app_preference': m006AppPreference,
  '007_license_activation': m007LicenseActivation,
  '008_gst_registration_type': m008GstRegistrationType,
  '009_demo_and_trial': m009DemoAndTrial,
};
