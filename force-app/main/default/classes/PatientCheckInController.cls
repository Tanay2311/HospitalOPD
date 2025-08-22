/**
 * @description Handles server-side logic for the Patient Check-In component.
 * Facilitates finding today's appointments and updating their status upon arrival.
 */
public with sharing class PatientCheckInController {

    /**
     * @description Finds appointments for the current day with a 'Scheduled' status,
     * filtered by an optional patient name search term.
     * @param searchTerm A string to filter patient names.
     * @return A list of matching Appointment__c records.
     */
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

    /**
     * @description Updates an appointment's status to 'Checked-In' and records the arrival time.
     * @param appointmentId The ID of the appointment to update.
     * @param arrivalTime The actual time the patient arrived.
     * @return A string indicating success.
     */
    @AuraEnabled
    // The 'reasonForVisit' parameter is removed as it's now part of the scheduling process.
    public static String checkInPatient(Id appointmentId, Datetime arrivalTime) {
        try {
            // Query for the specific appointment to ensure it exists and the user has access
            Appointment__c appt = [
                SELECT Id FROM Appointment__c WHERE Id = :appointmentId WITH SECURITY_ENFORCED
            ];

            // Update the fields
            appt.Status__c = 'Checked-In';
            appt.Arrival_Time__c = arrivalTime;
            // The 'Reason_for_Visit__c' is no longer set here.

            update appt;
            return 'Success';
        } catch (Exception e) {
            throw new AuraHandledException('Check-in failed: ' + e.getMessage());
        }
    }
}