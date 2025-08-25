public with sharing class AppointmentSchedulerController {

    public class CalendarEvent {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public Datetime start;
        @AuraEnabled public Datetime eventEnd;
        @AuraEnabled public String color;
        @AuraEnabled public Map<String, Object> extendedProps;
    }

    @AuraEnabled(cacheable=true)
    public static List<CalendarEvent> getAppointments(Id doctorId, Datetime startDate, Datetime endDate) {
        List<Appointment__c> appointments;

        if (String.isNotBlank(doctorId)) {
            appointments = [
                SELECT Id, Patient__c, Patient__r.Name, Doctor__c, Doctor__r.Name, Doctor__r.Department__c,
                       Start_Time__c, End_Time__c, Status__c
                FROM Appointment__c 
                WHERE Doctor__c = :doctorId
                  AND Start_Time__c >= :startDate
                  AND End_Time__c   <= :endDate
                WITH SECURITY_ENFORCED
                ORDER BY Start_Time__c
            ];
        } else {
            appointments = [
                SELECT Id, Patient__c, Patient__r.Name, Doctor__c, Doctor__r.Name, Doctor__r.Department__c,
                       Start_Time__c, End_Time__c, Status__c
                FROM Appointment__c 
                WHERE Start_Time__c >= :startDate
                  AND End_Time__c   <= :endDate
                WITH SECURITY_ENFORCED
                ORDER BY Start_Time__c
            ];
        }

        List<CalendarEvent> events = new List<CalendarEvent>();
        for (Appointment__c appt : appointments) {
            CalendarEvent event = new CalendarEvent();
            event.id = appt.Id;
            event.title = appt.Patient__r.Name + ' (' + appt.Doctor__r.Department__c + ')';
            event.start = appt.Start_Time__c;
            event.eventEnd = appt.End_Time__c;

            if (appt.Status__c == 'Scheduled')      event.color = '#0070d2';
            else if (appt.Status__c == 'Completed') event.color = '#04844b';
            else                                    event.color = '#5e5e5e';
            
            event.extendedProps = new Map<String, Object>{
                'patientId' => appt.Patient__c,
                'doctorId'  => appt.Doctor__c,
                'doctorName'=> appt.Doctor__r.Name,
                'status'    => appt.Status__c
            };
            events.add(event);
        }
        return events;
    }

    @AuraEnabled(cacheable=true)
    public static List<Doctor__c> getDoctors() {
        return [SELECT Id, Name FROM Doctor__c WHERE Is_Active__c = true ORDER BY Name];
    }

    @AuraEnabled
    public static String scheduleAppointment(Id patientId, Id doctorId, Datetime startTime, Datetime endTime,  String reasonForVisit) {
        if (startTime < Datetime.now()) {
            throw new AuraHandledException('Appointments cannot be scheduled in the past.');
        }
        
        // 1) Doctor overlap
        List<Appointment__c> doctorConflicts = [
            SELECT Id
            FROM Appointment__c
            WHERE Doctor__c = :doctorId
              AND Status__c = 'Scheduled'
              AND (Start_Time__c < :endTime AND End_Time__c > :startTime)
            WITH SECURITY_ENFORCED
        ];
        if (!doctorConflicts.isEmpty()) {
            throw new AuraHandledException('This time slot is no longer available. Please select a different time.');
        }

        // 2) Patient overlap (across ANY doctor)
        List<Appointment__c> patientConflicts = [
            SELECT Id
            FROM Appointment__c
            WHERE Patient__c = :patientId
              AND Status__c = 'Scheduled'
              AND (Start_Time__c < :endTime AND End_Time__c > :startTime)
            WITH SECURITY_ENFORCED
        ];
        if (!patientConflicts.isEmpty()) {
            throw new AuraHandledException('This patient already has an appointment at this time.');
        }

        try {
            Appointment__c newAppointment = new Appointment__c(
                Patient__c   = patientId,
                Doctor__c    = doctorId,
                Start_Time__c= startTime,
                End_Time__c  = endTime,
                Reason_for_Visit__c = reasonForVisit,
                Status__c    = 'Scheduled'
            );
            insert newAppointment;
            return newAppointment.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String updateAppointmentTime(Id appointmentId, Datetime newStartTime, Datetime newEndTime) {
        if (newStartTime < Datetime.now()) {
            throw new AuraHandledException('Appointments cannot be rescheduled to the past.');
        }
        
        try {
            Appointment__c apptToUpdate = [
                SELECT Id, Doctor__c, Patient__c
                FROM Appointment__c
                WHERE Id = :appointmentId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];

            // Doctor overlap excluding this appointment
            List<Appointment__c> doctorConflicts = [
                SELECT Id
                FROM Appointment__c
                WHERE Doctor__c = :apptToUpdate.Doctor__c
                  AND Id != :appointmentId
                  AND Status__c = 'Scheduled'
                  AND (Start_Time__c < :newEndTime AND End_Time__c > :newStartTime)
                WITH SECURITY_ENFORCED
            ];
            if (!doctorConflicts.isEmpty()) {
                throw new AuraHandledException('This time slot is already booked for this doctor. Please choose another.');
            }

            // Patient overlap excluding this appointment (cross-doctor)
            List<Appointment__c> patientConflicts = [
                SELECT Id
                FROM Appointment__c
                WHERE Patient__c = :apptToUpdate.Patient__c
                  AND Id != :appointmentId
                  AND Status__c = 'Scheduled'
                  AND (Start_Time__c < :newEndTime AND End_Time__c > :newStartTime)
                WITH SECURITY_ENFORCED
            ];
            if (!patientConflicts.isEmpty()) {
                throw new AuraHandledException('This patient already has another appointment at this time.');
            }

            apptToUpdate.Start_Time__c = newStartTime;
            apptToUpdate.End_Time__c   = newEndTime;
            update apptToUpdate;
            return 'Success';
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String updateAppointmentStatus(Id appointmentId, String newStatus) {
        try {
            if (newStatus == 'Canceled') {
                // Delete to free the slot entirely
                delete new Appointment__c(Id = appointmentId);
                return 'Deleted';
            } else {
                Appointment__c appt = [SELECT Id, Status__c FROM Appointment__c WHERE Id = :appointmentId WITH SECURITY_ENFORCED];
                appt.Status__c = newStatus;
                update appt;
                return 'Success';
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String deleteAppointment(Id appointmentId) {
        try {
            delete new Appointment__c(Id = appointmentId);
            return 'Success';
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Patient__c> searchPatients(String searchTerm) {
        String searchKeyword = '%' + searchTerm + '%';
        return [
            SELECT Id, Name, Patient_ID__c
            FROM Patient__c 
            WHERE Name LIKE :searchKeyword OR Patient_ID__c LIKE :searchKeyword
            ORDER BY Name
            LIMIT 50
        ];
    }


    @AuraEnabled(cacheable=true)
    public static List<String> getDepartments() {
        List<Doctor__c> doctors = [SELECT Department__c FROM Doctor__c WHERE Department__c != NULL];
        Set<String> uniqueDepartments = new Set<String>();

        for (Doctor__c doc : doctors) {
            uniqueDepartments.add(doc.Department__c);
        }

        return new List<String>(uniqueDepartments);
    }


    @AuraEnabled(cacheable=true)
    public static List<Doctor__c> getDoctorsByDepartment(String department) {
        return [SELECT Id, Name, Department__c
                FROM Doctor__c 
                WHERE Is_Active__c = true AND Department__c = :department
                ORDER BY Name];
    }


}
