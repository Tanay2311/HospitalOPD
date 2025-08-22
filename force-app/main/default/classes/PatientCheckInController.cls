
public with sharing class PatientCheckInController {

    
    @AuraEnabled(cacheable=true)
    public static List<Appointment__c> getTodaysAppointments(String searchTerm) {
        Date today = Date.today();
        // Prepare the search key for a 'LIKE' query
        String searchKey = '%' + (String.isBlank(searchTerm) ? '' : searchTerm) + '%';

        return [
            SELECT Id, Patient__r.Name, Doctor__r.Name, Start_Time__c, Status__c
            FROM Appointment__c
            WHERE DAY_ONLY(Start_Time__c) = :today
              AND Status__c = 'Scheduled'
              AND Patient__r.Name LIKE :searchKey
            WITH SECURITY_ENFORCED
            ORDER BY Start_Time__c
            LIMIT 50
        ];
    }

    
    @AuraEnabled
    
    public static String checkInPatient(Id appointmentId, Datetime arrivalTime) {
        try {
            Appointment__c appt = [
                SELECT Id FROM Appointment__c WHERE Id = :appointmentId WITH SECURITY_ENFORCED
            ];

            // Update the fields
            appt.Status__c = 'Checked-In';
            appt.Arrival_Time__c = arrivalTime;

            update appt;
            return 'Success';
        } catch (Exception e) {
            throw new AuraHandledException('Check-in failed: ' + e.getMessage());
        }
    }
}