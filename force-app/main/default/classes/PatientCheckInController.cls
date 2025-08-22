public with sharing class PatientCheckInController {

    @AuraEnabled(cacheable=true)
    public static List<Appointment__c> getTodaysAppointments(String searchTerm) {
        Date today = Date.today();
        String searchKey = '%' + (String.isBlank(searchTerm) ? '' : searchTerm) + '%';
        List<String> statuses = new List<String>{'Scheduled', 'Checked-In'};

        return [
            SELECT Id, Patient__r.Name, Doctor__r.Name, Start_Time__c, Status__c, Reason_for_Visit__c
            FROM Appointment__c
            WHERE DAY_ONLY(Start_Time__c) = :today
              AND Status__c IN :statuses
              AND Patient__r.Name LIKE :searchKey
            WITH SECURITY_ENFORCED
            ORDER BY Start_Time__c
            LIMIT 50
        ];
    }

    @AuraEnabled
    public static String checkInPatient(Id appointmentId, Datetime arrivalTime) {
        try {
            Appointment__c appt = [SELECT Id FROM Appointment__c WHERE Id = :appointmentId WITH SECURITY_ENFORCED];
            appt.Status__c = 'Checked-In';
            appt.Arrival_Time__c = arrivalTime;
            update appt;
            return 'Success';
        } catch (Exception e) {
            throw new AuraHandledException('Check-in failed: ' + e.getMessage());
        }
    }

    
    @AuraEnabled
    public static String checkOutPatient(Id appointmentId) {
        try {
            Appointment__c appt = [SELECT Id FROM Appointment__c WHERE Id = :appointmentId WITH SECURITY_ENFORCED];
            appt.Status__c = 'Completed';
            update appt;
            return 'Success';
        } catch (Exception e) {
            throw new AuraHandledException('Check-out failed: ' + e.getMessage());
        }
    }
}