import { LightningElement, track, wire } from 'lwc';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import FullCalendarJS from '@salesforce/resourceUrl/FullCalendarJS';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getDoctors from '@salesforce/apex/AppointmentSchedulerController.getDoctors';
import getDepartments from '@salesforce/apex/AppointmentSchedulerController.getDepartments';
import getDoctorsByDepartment from '@salesforce/apex/AppointmentSchedulerController.getDoctorsByDepartment';
import getAppointments from '@salesforce/apex/AppointmentSchedulerController.getAppointments';
import scheduleAppointment from '@salesforce/apex/AppointmentSchedulerController.scheduleAppointment';
import updateAppointmentTime from '@salesforce/apex/AppointmentSchedulerController.updateAppointmentTime';
import updateAppointmentStatus from '@salesforce/apex/AppointmentSchedulerController.updateAppointmentStatus';
import deleteAppointment from '@salesforce/apex/AppointmentSchedulerController.deleteAppointment';
import searchPatients from '@salesforce/apex/AppointmentSchedulerController.searchPatients';

export default class AppointmentScheduler extends LightningElement {
    calendar;
    calendarInitialized = false;
    isLoading = true;
    
    // Filter properties
    @track departmentOptions = [];
    selectedDepartment = '';
    @track doctorOptions = [];
    selectedDoctorId = '';

    // Event Details Modal properties
    isModalOpen = false;
    @track selectedEvent = {};

    // New Appointment Modal properties
    isPatientModalOpen = false;
    patientSearchTerm = '';
    @track patientOptions = [];
    selectedPatientId = null;
    selectedSlot = null;
    @track reasonForVisit = '';
    searchTimeout;

    get statusOptions() {
        return [
            { label: 'Scheduled', value: 'Scheduled' },
            { label: 'Completed', value: 'Completed' },
            { label: 'Canceled', value: 'Canceled' },
            { label: 'No Show', value: 'No Show' },
        ];
    }

    // Wires for initial data load
    @wire(getDoctors)
    wiredDoctors({ error, data }) {
        if (data) {
            this.doctorOptions = data.map(doctor => ({ label: doctor.Name, value: doctor.Id }));
            this.doctorOptions.unshift({ label: 'All Doctors', value: '' });
        } else if (error) {
            this.showToast('Error', 'Could not load the list of doctors.', 'error');
        }
    }

    @wire(getDepartments)
    wiredDepartments({ error, data }) {
        if (data) {
            this.departmentOptions = data.map(dep => ({ label: dep, value: dep }));
            this.departmentOptions.unshift({ label: 'All Departments', value: '' });
        } else if (error) {
            this.showToast('Error', 'Could not load departments.', 'error');
        }
    }

    // Load and initialize FullCalendar
    renderedCallback() {
        if (this.calendarInitialized) return;
        this.calendarInitialized = true;

        Promise.all([
            loadStyle(this, FullCalendarJS + '/main.min.css'),
            loadScript(this, FullCalendarJS + '/main.min.js')
        ])
        .then(() => { this.initializeCalendar(); })
        .catch(error => {
            console.error('Error loading FullCalendar:', error);
            this.showToast('Error', 'Failed to load calendar library.', 'error');
        });
    }

    initializeCalendar() {
        const calendarEl = this.template.querySelector('.calendar-container');
        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            editable: true,
            selectable: true,
            events: (fetchInfo, successCallback, failureCallback) => { this.loadEvents(fetchInfo, successCallback, failureCallback); },
            select: (selectionInfo) => { this.handleSlotSelect(selectionInfo); },
            eventDrop: (info) => { this.handleEventDrop(info); },
            eventClick: (info) => { this.handleEventClick(info); }
        });
        this.calendar.render();
    }

    loadEvents(fetchInfo, successCallback, failureCallback) {
        this.isLoading = true;
        getAppointments({
            doctorId: this.selectedDoctorId || null,
            startDate: fetchInfo.start,
            endDate: fetchInfo.end
        })
        .then(result => {
            const mappedEvents = result.map(event => ({ ...event, end: event.eventEnd }));
            successCallback(mappedEvents);
        })
        .catch(error => {
            failureCallback(error);
            this.showToast('Error', 'Failed to fetch appointments.', 'error');
        })
        .finally(() => { this.isLoading = false; });
    }

    // --- FILTER HANDLERS ---
    handleDepartmentChange(event) {
        this.selectedDepartment = event.detail.value;
        this.selectedDoctorId = ''; // Reset doctor selection

        const doctorPromise = this.selectedDepartment
            ? getDoctorsByDepartment({ department: this.selectedDepartment })
            : getDoctors(); // Fallback to all doctors

        doctorPromise
            .then(result => {
                this.doctorOptions = result.map(doc => ({ label: doc.Name, value: doc.Id }));
                this.doctorOptions.unshift({ label: 'All Doctors', value: '' });
            })
            .catch(() => this.showToast('Error', 'Could not fetch doctors.', 'error'));
    }

    handleDoctorChange(event) {
        this.selectedDoctorId = event.detail.value;
        this.calendar.refetchEvents();
    }

    // --- NEW APPOINTMENT LOGIC ---
    handleSlotSelect(selectionInfo) {
        if (!this.selectedDoctorId) {
            this.showToast('Info', 'Please select a doctor before booking an appointment.', 'info');
            return;
        }
        this.selectedSlot = selectionInfo;
        this.isPatientModalOpen = true;
    }

    handlePatientSearch(event) {
        this.patientSearchTerm = event.detail.value;
        clearTimeout(this.searchTimeout);

        if (this.patientSearchTerm && this.patientSearchTerm.length >= 2) {
            this.searchTimeout = setTimeout(() => {
                searchPatients({ searchTerm: this.patientSearchTerm })
                    .then(result => {
                        this.patientOptions = result.map(p => ({ label: `${p.Name} (ID: ${p.Patient_ID__c})`, value: p.Id }));
                    })
                    .catch(() => this.showToast('Error', 'Could not fetch patients.', 'error'));
            }, 300);
        } else {
            this.patientOptions = [];
        }
    }

    handlePatientSelect(event) {
        this.selectedPatientId = event.detail.value;
    }

    handleReasonChange(event) {
        this.reasonForVisit = event.target.value;
    }

    confirmAppointment() {
        if (!this.selectedPatientId) {
            this.showToast('Error', 'Please select a patient.', 'error');
            return;
        }
        // **COMPLETED** Added validation for Reason for Visit
        if (!this.reasonForVisit) {
            this.showToast('Error', 'Please enter a reason for the visit.', 'error');
            return;
        }
        
        this.isLoading = true;
        scheduleAppointment({
            patientId: this.selectedPatientId,
            doctorId: this.selectedDoctorId,
            startTime: this.selectedSlot.start,
            endTime: this.selectedSlot.end,
            reasonForVisit: this.reasonForVisit // **COMPLETED** Pass reason to Apex
        })
        .then(() => {
            this.showToast('Success', 'Appointment was successfully booked.', 'success');
            this.calendar.refetchEvents();
            this.closePatientModal();
        })
        .catch(error => {
            this.showToast('Error', error?.body?.message || 'Could not book appointment.', 'error');
        })
        .finally(() => { this.isLoading = false; });
    }

    closePatientModal() {
        this.isPatientModalOpen = false;
        this.patientSearchTerm = '';
        this.patientOptions = [];
        this.selectedPatientId = null;
        this.selectedSlot = null;
        this.reasonForVisit = ''; // **COMPLETED** Reset reason on close
    }

    // --- EXISTING APPOINTMENT LOGIC ---
    handleEventDrop(info) {
        this.isLoading = true;
        updateAppointmentTime({
            appointmentId: info.event.id,
            newStartTime: info.event.start,
            newEndTime: info.event.end
        })
        .then(() => this.showToast('Success', 'Appointment was successfully rescheduled.', 'success'))
        .catch(error => {
            info.revert();
            this.showToast('Error', error?.body?.message || 'Could not reschedule.', 'error');
        })
        .finally(() => { this.isLoading = false; });
    }

    handleEventClick(info) {
        const event = info.event;
        this.selectedEvent = {
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            patientId: event.extendedProps.patientId,
            doctorId: event.extendedProps.doctorId,
            doctorName: event.extendedProps.doctorName,
            status: event.extendedProps.status
        };
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    handleStatusChange(event) {
        this.selectedEvent.status = event.detail.value;
    }
    
    handleSave() {
        this.isLoading = true;
        updateAppointmentStatus({
            appointmentId: this.selectedEvent.id,
            newStatus: this.selectedEvent.status
        })
        .then(() => {
            this.showToast('Success', 'Appointment status updated.', 'success');
            this.calendar.refetchEvents();
            this.closeModal();
        })
        .catch(error => {
            this.showToast('Error', error?.body?.message || 'Could not update status.', 'error');
        })
        .finally(() => { this.isLoading = false; });
    }

    handleDelete() {
        if (confirm('Are you sure you want to delete this appointment?')) {
            this.isLoading = true;
            deleteAppointment({ appointmentId: this.selectedEvent.id })
                .then(() => {
                    this.showToast('Success', 'Appointment deleted.', 'success');
                    this.calendar.refetchEvents();
                    this.closeModal();
                })
                .catch(error => this.showToast('Error', error?.body?.message || 'Could not delete.', 'error'))
                .finally(() => { this.isLoading = false; });
        }
    }

    // --- UTILITY ---
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}