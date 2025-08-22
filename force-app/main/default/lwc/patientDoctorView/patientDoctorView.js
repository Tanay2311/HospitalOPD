import { LightningElement, wire, track } from 'lwc';
import getAllPatients from '@salesforce/apex/PatientDoctorViewerController.getAllPatients';
import getAllDoctors from '@salesforce/apex/PatientDoctorViewerController.getAllDoctors';

export default class PatientDoctorViewer extends LightningElement {
    @track patients = [];
    @track doctors = [];
    @track error;

    patientColumns = [
        { label: 'Name', fieldName: 'Name' },
        { label: 'Patient ID', fieldName: 'Patient_ID__c' },
        { label: 'DOB', fieldName: 'Date_of_Birth__c', type: 'date' },
        { label: 'Contact', fieldName: 'Contact_Number__c' },
        { label: 'Email', fieldName: 'Email__c' }
    ];

    doctorColumns = [
        { label: 'Doctor ID', fieldName: 'Doctor__c' },
        { label: 'Name', fieldName: 'Name' },
        { label: 'Department', fieldName: 'Department__c' },
        { label: 'Email', fieldName: 'Email__c' },
        { label: 'Phone', fieldName: 'Phone__c' }
    ];

    @wire(getAllPatients)
    wiredPatients({ error, data }) {
        if (data) {
            this.patients = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.patients = [];
        }
    }

    @wire(getAllDoctors)
    wiredDoctors({ error, data }) {
        if (data) {
            this.doctors = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.doctors = [];
        }
    }
}
