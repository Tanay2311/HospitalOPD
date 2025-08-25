import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
// --- RENAMED APEX IMPORT ---
import getAppointments from '@salesforce/apex/PatientCheckInController.getAppointments';
import checkInPatient from '@salesforce/apex/PatientCheckInController.checkInPatient';
import checkOutPatient from '@salesforce/apex/PatientCheckInController.checkOutPatient';

const columns = [
    { label: 'Patient Name', fieldName: 'PatientName', type: 'text' },
    { label: 'Contact Number', fieldName: 'PatientContact', type: 'phone' },
    { label: 'Appointment Date', fieldName: 'AppointmentDate', type: 'date-local',
        typeAttributes: {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }
    },
    { label: 'Reason for Visit', fieldName: 'Reason_for_Visit__c', type: 'text', wrapText: true },
    { label: 'Status', fieldName: 'Status__c', type: 'text',
        cellAttributes: { class: { fieldName: 'statusClass' } }
    },
    { label: 'Scheduled Time', fieldName: 'StartTime', type: 'date',
        typeAttributes: { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }
    },
    { label: 'Doctor', fieldName: 'DoctorName', type: 'text' },
    {
        type: 'action',
        typeAttributes: { rowActions: { fieldName: 'rowActions' } }
    }
];

export default class PatientCheckIn extends LightningElement {
    @track searchTerm = '';
    @track appointments = [];
    wiredAppointmentsResult;
    columns = columns;

    // --- NEW PROPERTIES FOR DATE FILTERING ---
    @track filterType = 'TODAY'; // Default filter
    @track startDate = new Date().toISOString().slice(0, 10);
    @track endDate = new Date().toISOString().slice(0, 10);

    isModalOpen = false;
    selectedAppointmentId = '';
    selectedPatientName = '';
    selectedAppointmentTime = '';
    selectedReasonForVisit = '';
    arrivalTime = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 19);

    // --- UPDATED WIRE SERVICE CALL ---
    @wire(getAppointments, {
        searchTerm: '$searchTerm',
        filterType: '$filterType',
        startDate: '$startDate',
        endDate: '$endDate'
    })
    wiredAppointments(result) {
        this.wiredAppointmentsResult = result;
        if (result.data) {
            this.appointments = result.data.map(appt => {
                const isScheduled = appt.Status__c === 'Scheduled';
                const rowActions = isScheduled
                    ? [{ label: 'Check-In', name: 'check_in' }]
                    : [{ label: 'Check-Out', name: 'check_out' }];
                const statusClass = isScheduled
                    ? 'slds-text-color_default'
                    : 'slds-text-color_success slds-text-heading_small';

                return {
                    ...appt,
                    PatientName: appt.Patient__r.Name,
                    DoctorName: appt.Doctor__r.Name,
                    StartTime: appt.Start_Time__c,
                    rowActions: rowActions,
                    statusClass: statusClass,
                    AppointmentDate: appt.Start_Time__c,
                    PatientContact: appt.Patient__r.Contact_Number__c
                };
            });
        } else if (result.error) {
            console.error('Error loading appointments:', JSON.stringify(result.error));
            this.showToast('Error Loading Data', 'Could not fetch appointments.', 'error');
        }
    }

    // --- NEW GETTERS FOR UI LOGIC ---
    get showCustomDateInputs() {
        return this.filterType === 'CUSTOM_DATE' || this.filterType === 'CUSTOM_RANGE';
    }

    get isCustomRangeFilter() {
        return this.filterType === 'CUSTOM_RANGE';
    }

    // --- NEW EVENT HANDLERS FOR FILTERS ---
    handleFilterClick(event) {
        const selectedFilter = event.target.name;
        this.filterType = selectedFilter;
        
        // Update button styles to show which is active
        this.template.querySelectorAll('lightning-button-group lightning-button').forEach(button => {
            button.variant = button.name === selectedFilter ? 'brand' : 'neutral';
        });
    }

    handleDateChange(event) {
        const field = event.target.name;
        if (field === 'startDate') {
            this.startDate = event.target.value;
        } else if (field === 'endDate') {
            this.endDate = event.target.value;
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
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        if (actionName === 'check_in') {
            this.selectedAppointmentId = row.Id;
            this.selectedPatientName = row.PatientName;
            this.selectedAppointmentTime = row.StartTime;
            this.selectedReasonForVisit = row.Reason_for_Visit__c;
            this.arrivalTime = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 19);
            this.isModalOpen = true;
        } else if (actionName === 'check_out') {
            this.confirmCheckOut(row.Id, row.PatientName);
        }
    }

    // --- Check-In Logic ---
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

    // --- Check-Out Logic ---
    confirmCheckOut(appointmentId, patientName) {
        checkOutPatient({ appointmentId: appointmentId })
        .then(() => {
            this.showToast('Success', `${patientName} has been checked out.`, 'success');
            return refreshApex(this.wiredAppointmentsResult);
        })
        .catch(error => {
            this.showToast('Check-Out Failed', error.body.message, 'error');
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}