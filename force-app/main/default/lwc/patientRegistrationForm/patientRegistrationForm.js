import { LightningElement, track } from 'lwc';
import registerPatientFull from '@salesforce/apex/PatientRegistrationController.registerPatientFull';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PatientRegistrationForm extends LightningElement {
    // Wizard step: '1' | '2' | '3'
    @track currentStep = '1';

    // Step 1: Patient
    @track patient = {
        patientName: '',
        dateOfBirth: null,
        contactNumber: '',
        email: '',
        address: '',
        gender:''
    };

    get genderOptions() {
        return [
            { label: 'Male', value: 'Male' },
            { label: 'Female', value: 'Female' },
            { label: 'Other', value: 'Other' },
            
        ];
    }

    // Step 2: Insurance
    @track insurance = {
        provider: '',
        policyNumber: '',
        validTill: null,
        isActive: false
    };

    // Step 3: Medical History
    @track medicalHistory = {
        condition: '',
        diagnosedDate: null,
        notes: ''
    };

    // -------- Getters for rendering --------
    get isStep1() { return this.currentStep === '1'; }
    get isStep2() { return this.currentStep === '2'; }
    get isStep3() { return this.currentStep === '3'; }
    get isFirstStep() { return this.currentStep === '1'; }
    get isLastStep() { return this.currentStep === '3'; }

    // -------- Handlers --------
    handleChange(event) {
        const section = event.target.dataset.section; // 'patient' | 'insurance' | 'medicalHistory'
        const { name, value } = event.target;
        this[section] = { ...this[section], [name]: value };
    }
    handleCheckbox(event) {
        const section = event.target.dataset.section;
        const { name, checked } = event.target;
        this[section] = { ...this[section], [name]: checked };
    }

    // -------- Navigation --------
    handleNext = () => {
        if (!this.validateCurrentStep()) return;
        if (this.currentStep === '1') this.currentStep = '2';
        else if (this.currentStep === '2') this.currentStep = '3';
    };
    handleBack = () => {
        if (this.currentStep === '3') this.currentStep = '2';
        else if (this.currentStep === '2') this.currentStep = '1';
    };

    // -------- Validation per step (client-side) --------
    validateCurrentStep() {
        // Report validity for visible inputs only
        const inputs = this.template.querySelectorAll('lightning-input, lightning-textarea');
        let allValid = true;
        inputs.forEach((cmp) => {
            cmp.reportValidity();
            allValid = allValid && cmp.checkValidity();
        });

        if (!allValid) {
            this.toast('Error', 'Please fix validation errors on this step.', 'error');
            return false;
        }

        // Custom validations
        if (this.isStep1) {
            // 1. Check for required fields
            if (!this.patient.patientName || !this.patient.dateOfBirth || !this.patient.contactNumber) {
                this.toast('Error', 'All patient details are required.', 'error');
                return false;
            }

            // 2. Check contact number length
            if (this.patient.contactNumber.length !== 10) {
                this.toast('Error', 'Contact Number must be 10 digits.', 'error');
                return false;
            }

            // 3. Check for a future date of birth
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to the beginning of today
            const dob = new Date(this.patient.dateOfBirth);

            if (dob > today) {
                this.toast('Error', 'Date of Birth cannot be in the future.', 'error');
                return false;
            }

            // mandatory gender input
            if (!this.patient.gender) {
                this.toast('Error', 'Gender is a required field.', 'error');
                return false; 
            }
        }


        if (this.isStep2) {
            const anyInsurance =
                (this.insurance.provider && this.insurance.provider.trim() !== '') ||
                (this.insurance.policyNumber && this.insurance.policyNumber.trim() !== '') ||
                !!this.insurance.validTill || !!this.insurance.isActive;

            if (anyInsurance) {
                if (!this.insurance.provider || this.insurance.provider.trim() === '') {
                    this.toast('Error', 'Insurance Provider is required when adding Insurance.', 'error');
                    return false;
                }
                if (!this.insurance.policyNumber || this.insurance.policyNumber.trim() === '') {
                    this.toast('Error', 'Policy Number is required when adding Insurance.', 'error');
                    return false;
                }
            }
        }

        // Step 3 has no required fields (optional)
        return true;
    }

    // -------- Submit --------
    handleSubmit = () => {
        if (!this.validateCurrentStep()) return;

        const payload = {
            patient: this.patient,
            insurance: this.insurance,
            medicalHistory: this.medicalHistory
        };

        registerPatientFull({ dataJson: JSON.stringify(payload) })
            .then((patientId) => {
                this.toast('Success', 'Patient registered successfully. ID: ' + patientId, 'success');
                this.resetAll();
            })
            .catch((error) => {
                const msg = (error && error.body && error.body.message) ? error.body.message : 'An error occurred.';
                this.toast('Error', msg, 'error');
            });
    };

    // -------- Helpers --------
    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
    resetAll() {
        this.currentStep = '1';
        this.patient = { patientName: '', dateOfBirth: null, contactNumber: '', email: '', address: '', gender:'' };
        this.insurance = { provider: '', policyNumber: '', validTill: null, isActive: false };
        this.medicalHistory = { condition: '', diagnosedDate: null, notes: '' };
        // Clear UI validity
        const inputs = this.template.querySelectorAll('lightning-input, lightning-textarea');
        inputs.forEach(i => i.value = i.type === 'checkbox' ? false : (i.type === 'date' ? null : ''));
    }
}
