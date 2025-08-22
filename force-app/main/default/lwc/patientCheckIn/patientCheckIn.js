import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getTodaysAppointments from '@salesforce/apex/PatientCheckInController.getTodaysAppointments';
import checkInPatient from '@salesforce/apex/PatientCheckInController.checkInPatient';

const columns = [
    { label: 'Patient Name', fieldName: 'PatientName', type: 'text' },
    { label: 'Reason for Visit', fieldName: 'Reason_for_Visit__c', type: 'text', initialWidth: 250 },
    { label: 'Scheduled Time', fieldName: 'StartTime', type: 'date', // Use 'date' type for better formatting
        typeAttributes: {
            timeZone: 'Asia/Kolkata', 
            hour: '2-digit',
            minute: '2-digit',
            hour12: true 
        } },
    { label: 'Doctor', fieldName: 'DoctorName', type: 'text' },
    {
        type: 'button',
        typeAttributes: {
            label: 'Check-In',
            name: 'check_in',
            variant: 'brand'
        }
    }
];

export default class PatientCheckIn extends LightningElement {
    @track searchTerm = '';
    @track appointments = [];
    wiredAppointmentsResult;
    columns = columns;

    isModalOpen = false;
    selectedAppointmentId = '';
    selectedPatientName = '';
    selectedAppointmentTime = '';
    selectedReasonForVisit = '';
    arrivalTime = new Date().toISOString();

    @wire(getTodaysAppointments, { searchTerm: '$searchTerm' })
    wiredAppointments(result) {
        this.wiredAppointmentsResult = result;
        if (result.data) {
            this.appointments = result.data.map(appt => ({
                ...appt,
                PatientName: appt.Patient__r.Name,
                DoctorName: appt.Doctor__r.Name,
                StartTime: appt.Start_Time__c
            }));
        } else if (result.error) {
            this.showToast('Error Loading Data', 'Could not fetch appointments.', 'error');
        }
    }

    handleSearch(event) {
        window.clearTimeout(this.delayTimeout);
        const searchTerm = event.target.value;
        this.delayTimeout = setTimeout(() => {
            this.searchTerm = searchTerm;
        }, 300);
    }

    handleRowAction(event) {
        const row = event.detail.row;
        this.selectedAppointmentId = row.Id;
        this.selectedPatientName = row.PatientName;
        this.selectedAppointmentTime = row.StartTime;
        this.selectedReasonForVisit = row.Reason_for_Visit__c;
        
        this.arrivalTime = new Date().toISOString();
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    handleTimeChange(event) {
        this.arrivalTime = event.target.value;
    }

    confirmCheckIn() {
        this.closeModal(); 
        checkInPatient({
            appointmentId: this.selectedAppointmentId,
            arrivalTime: this.arrivalTime
        })
        .then(() => {
            this.showToast('Success', `${this.selectedPatientName} has been checked in.`, 'success');
            return refreshApex(this.wiredAppointmentsResult);

        })
        .catch(error => {
            this.showToast('Check-In Failed', error.body.message, 'error');
        });
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}