public with sharing class PatientCheckInController {

    @AuraEnabled(cacheable=true)
    public static List<Appointment__c> getAppointments(String searchTerm, String filterType, Date startDate, Date endDate) {
        String searchKey = '%' + (String.isBlank(searchTerm) ? '' : searchTerm) + '%';
        List<String> statuses = new List<String>{'Scheduled', 'Checked-In'};

        String query = 'SELECT Id, Patient__r.Name, Patient__r.Contact_Number__c, Doctor__r.Name, ' +
                       'Start_Time__c, Status__c, Reason_for_Visit__c ' +
                       'FROM Appointment__c ' +
                       'WHERE Status__c IN :statuses ';

        
        if (String.isNotBlank(searchTerm)) {
            query += 'AND (Patient__r.Name LIKE :searchKey OR Patient__r.Contact_Number__c LIKE :searchKey) ';
        }

        // --- NEW DATE FILTER LOGIC ---
        if (filterType == 'TODAY') {
            query += 'AND DAY_ONLY(Start_Time__c) = TODAY ';
        } else if (filterType == 'TOMORROW') {
            query += 'AND DAY_ONLY(Start_Time__c) = TOMORROW ';
        } else if (filterType == 'YESTERDAY') {
            query += 'AND DAY_ONLY(Start_Time__c) = YESTERDAY ';
        } else if (filterType == 'CUSTOM_DATE' && startDate != null) {
            query += 'AND DAY_ONLY(Start_Time__c) = :startDate ';
        } else if (filterType == 'CUSTOM_RANGE' && startDate != null && endDate != null) {
            query += 'AND DAY_ONLY(Start_Time__c) >= :startDate AND DAY_ONLY(Start_Time__c) <= :endDate ';
        }
        
        query += ' WITH SECURITY_ENFORCED ORDER BY Start_Time__c LIMIT 50';

        return Database.query(query);
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