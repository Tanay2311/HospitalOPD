public with sharing class PatientDoctorViewerController {

    @AuraEnabled(cacheable=true)
    public static List<Patient__c> getAllPatients() {
        return [
            SELECT Id, Name, Patient_ID__c, Date_of_Birth__c, Contact_Number__c, Email__c
            FROM Patient__c
            ORDER BY CreatedDate DESC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Doctor__c> getAllDoctors() {
        return [
            SELECT Id, Name, Department__c, Email__c, Doctor__c, Phone__c
            FROM Doctor__c
            ORDER BY CreatedDate DESC
        ];
    }
}
