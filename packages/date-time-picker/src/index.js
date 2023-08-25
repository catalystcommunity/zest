import { BaseComponent } from "@catalystsquad/base-components";

// TODO: This is the basic flow, but we need a use case before we flesh it out, so I'm holding it here for the moment

const defaultStyles = `<style>
date-time-picker, :host {
    margin: auto 0;
}
</style>`

const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const monthShortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function getMonthStart(x) {
    let d = new Date(x);
    let first = new Date(d.setDate(1))
    let sunday = first.getDay();
    let diff = d.getDate() - sunday;
    return new Date(d.setDate(diff));
}

export default class DateTimePicker extends BaseComponent {
    input;
    picker;
    twentyFourHourFormat;
    includeSeconds;
    initialDate;
    // This will always start at today or the initialDate, 
    selectedDate;
    userSelected;
  
    constructor(){
        super()
        this.template = "";
        this.styleTemplate = defaultStyles;
        this.styles = document.createElement("style");
        this.input = document.createElement("input");
        this.picker = document.createElement("div");
        this.selectedDate = new Date();
        this.userSelected = false;
    }
    connectedCallback(){
        super.connectedCallback();
        this.convertKebabAttributes(["include-seconds", "twenty-four-hour-format", "initial-date"]);
        if (this.initialDate) {
            let dateAttempt = null;
            try {
                dateAttempt = new Date(Date.parse(this.initialDate));
            } catch (e) {
                console.log("Can't parse date for initialDate in DateTimePicker: " + this.initialDate);
                dateAttempt = new Date();
            }
            if (dateAttempt !== null) {
                this.selectedDate = dateAttempt;
            }
        }
        this.initInput();
        this.initPicker();
        this.render();
    }
    render(){
        this.root.innerHTML = "";
        this.root.appendChild(this.input);
        this.root.appendChild(this.picker);
        if(!this.userSelected){
            this.input.placeholder = this.selectedDate.toDateString();
        } else {
            this.input.value = this.selectedDate.toDateString();
        }
        if (this.styleTemplate) {
            this.styles.innerHTML = this.stringToElement(`${this.styleTemplate}`)
            this.root.appendChild(this.styles);
        }
    }
    selectDate(me, picked) {
        console.log(picked);
        me.userSelected = true;
        me.selectedDate = picked;
        me.render();
    }
    initInput() {
        this.input.type = "text";
        this.input.placeholder = this.selectedDate.toDateString();
        this.input.addEventListener("click", () => {
            this.picker.style.display = "flex";
        });
        this.input.addEventListener("input", () => {
            // Handle input changes and update the picker
        });
    }
    initPicker() {
        let me = this;
        this.picker.style.display = "flex";
        this.picker.textContent = '';
        let calendar = document.createElement("div");
        calendar.style.width = "12em";
        let startDay = getMonthStart(this.selectedDate);
        startDay.setDate(startDay.getDate() - 1);
        let month = document.createElement("div");
        month.style.width = "100%";
        month.innerHTML = monthNames[this.selectedDate.getMonth()];
        calendar.appendChild(month);
        let current = 0;
        for (let week = 0; current !== 2; week++) {
            let weekDiv = document.createElement("div");
            weekDiv.style.width = "100%";
            weekDiv.style.display = "flex";
            for (let day = 0; day < 7; day++) {
                let dayDiv = document.createElement("span");
                dayDiv.style.padding = "2px";
                let dayDate = new Date(startDay.setDate(startDay.getDate()+1));
                let dayNum = dayDate.getDate();
                // See if we've entered the current month, or left the current month, and update state
                if (dayNum === 1) { current++; }
                dayDiv.innerHTML = dayNum;
                dayDiv.onclick = function() {me.selectDate(me, dayDate)};
                weekDiv.appendChild(dayDiv);
            }
            calendar.appendChild(weekDiv);
        }
        this.picker.appendChild(calendar);
    }
}

class ShadowDateTimePicker extends DateTimePicker {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.root = this.shadow;
    }
    connectedCallback(){
        super.connectedCallback();
    }
}
export { DateTimePicker, ShadowDateTimePicker }