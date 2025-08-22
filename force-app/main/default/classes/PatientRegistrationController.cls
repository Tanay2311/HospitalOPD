    public with sharing class PatientRegistrationController {

        //Wrappers (payload from LWC)
        public class RegistrationWrapper {
            @AuraEnabled public PatientWrapper patient;
            @AuraEnabled public InsuranceWrapper insurance;
            @AuraEnabled public MedicalHistoryWrapper medicalHistory;
        }
        public class PatientWrapper {
            @AuraEnabled public String patientName;
            @AuraEnabled public Date dateOfBirth;
            @AuraEnabled public String contactNumber;
            @AuraEnabled public String email;
            @AuraEnabled public String address;
            @AuraEnabled public String gender;
        }
        public class InsuranceWrapper {
            @AuraEnabled public String provider;
            @AuraEnabled public String policyNumber;
            @AuraEnabled public Date validTill;
            @AuraEnabled public Boolean isActive;
        }
        public class MedicalHistoryWrapper {
            @AuraEnabled public String condition;
            @AuraEnabled public Date diagnosedDate;
            @AuraEnabled public String notes;
        }

        // Main endpoint
        @AuraEnabled
        public static Id registerPatientFull(String dataJson) {
            RegistrationWrapper payload;
            try {
                payload = (RegistrationWrapper) JSON.deserialize(dataJson, RegistrationWrapper.class);
            } catch (Exception e) {
                throw new AuraHandledException('Invalid data received. ' + e.getMessage());
            }

            // basic validation 
            if (payload == null || payload.patient == null) {
                throw new AuraHandledException('Patient information is required.');
            }
            if (String.isBlank(payload.patient.patientName)) {
                throw new AuraHandledException('Patient Name is required.');
            }
            if (payload.patient.dateOfBirth == null) {
                throw new AuraHandledException('Date of Birth is required.');
            }
            if (payload.patient.dateOfBirth > Date.today()) {
                throw new AuraHandledException('Date of Birth cannot be in the future.');
            }
            if (String.isBlank(payload.patient.contactNumber)) { 
                throw new AuraHandledException('Contact Number is required.');
            }
            if (payload.patient.contactNumber.replaceAll('[^0-9]','').length() != 10) {
                throw new AuraHandledException('Contact Number must be 10 digits.');
            }
            if (String.isNotBlank(payload.patient.email) && !Pattern.matches('...', payload.patient.email)) {
                throw new AuraHandledException('Please provide a valid email address.');
            }
            if (String.isBlank(payload.patient.gender)) {
                throw new AuraHandledException('Gender is required.');
            }
            


            //insert Patient
            Patient__c p = new Patient__c(
                Name               = payload.patient.patientName,
                Date_of_Birth__c   = payload.patient.dateOfBirth,
                Contact_Number__c  = payload.patient.contactNumber,
                Email__c           = payload.patient.email,
                Address__c         = payload.patient.address,
                Gender__c         = payload.patient.gender
            );

            try {
                insert p;
            } catch (DmlException d) {
                throw new AuraHandledException('Failed to create Patient. ' + d.getMessage());
            }

            // insert Insurance
            if (payload.insurance != null &&
                (!isBlank(payload.insurance.provider) ||
                !isBlank(payload.insurance.policyNumber) ||
                payload.insurance.validTill != null ||
                payload.insurance.isActive == true)) {

                
                if (isBlank(payload.insurance.provider)) {
                    throw new AuraHandledException('Insurance Provider is required when adding Insurance.');
                }
                if (isBlank(payload.insurance.policyNumber)) {
                    throw new AuraHandledException('Policy Number is required when adding Insurance.');
                }

                Insurance__c ins = new Insurance__c(
                    Patient__c       = p.Id,
                    Provider__c      = payload.insurance.provider,
                    Policy_Number__c = payload.insurance.policyNumber,
                    Valid_Till__c    = payload.insurance.validTill,
                    Is_Active__c     = (payload.insurance.isActive == null ? false : payload.insurance.isActive)
                );

                try {
                    insert ins;
                } catch (DmlException d) {
                    throw new AuraHandledException('Failed to create Insurance. ' + d.getMessage());
                }
            }

            // insert Medical History 
            if (payload.medicalHistory != null &&
                (!isBlank(payload.medicalHistory.condition) ||
                payload.medicalHistory.diagnosedDate != null ||
                !isBlank(payload.medicalHistory.notes))) {

                Medical_History__c mh = new Medical_History__c(
                    Patient__c        = p.Id,
                    Condition__c      = payload.medicalHistory.condition,
                    Diagnosed_Date__c = payload.medicalHistory.diagnosedDate,
                    Notes__c          = payload.medicalHistory.notes
                );

                try {
                    insert mh;
                } catch (DmlException d) {
                    throw new AuraHandledException('Failed to create Medical History. ' + d.getMessage());
                }
            }

            return p.Id;
        }

        private static Boolean isBlank(String s) {
            return s == null || String.isEmpty(s.trim());
        }

    }
