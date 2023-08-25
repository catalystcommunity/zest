import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import DateTimePicker from '../src';

const html = readFileSync(resolve(__dirname, './basic.html'), 'utf8');

describe('DateTimePicker', () => {
    beforeAll(() => {
        customElements.define('date-time-picker', DateTimePicker );
    });
    beforeEach(() => {
        document.documentElement.innerHTML = html.toString();
    });

    it("should initialize correctly", () => {
        const comp = new DateTimePicker();
        expect(comp).toBeInstanceOf(DateTimePicker);
    });

    it("should have today's date displayed in a placeholder at initial setup", () => {
        const comp = new DateTimePicker();
        const now = new Date();
        comp.connectedCallback(); // We have to call this because we're not actually in the dom
        expect(comp).toBeInstanceOf(DateTimePicker);
        expect(comp.selectedDate).toBeInstanceOf(Date);
        const diffMs = Math.abs(now - comp.selectedDate);
        const diffMins = Math.round(diffMs / 60000);
        expect(diffMins).toBeLessThanOrEqual(5);
        const compInput = comp.input;
        expect(compInput.placeholder).toEqual(now.toDateString());
    });

    it("should have no user selected state at initial setup", () => {
        const comp = new DateTimePicker();
        const now = new Date();
        comp.connectedCallback(); // We have to call this because we're not actually in the dom
        expect(comp).toBeInstanceOf(DateTimePicker);
        expect(comp.selectedDate).toBeInstanceOf(Date);
        expect(comp.userSelected).toEqual(false);
    });

    it("should have an input with no placeholder text before initInput", () => {
        const comp = new DateTimePicker();
        const now = new Date();
        const compInput = comp.input;
        comp.selectDate = now;
        expect(compInput.placeholder).toEqual("");
        comp.initInput();
        expect(compInput.placeholder).toEqual(now.toDateString());
    });


    it("should have an input with no placeholder text before initPicker", () => {
        const comp = new DateTimePicker();
        const now = new Date();
        const compPicker = comp.picker;
        expect(compPicker.innerHTML).toEqual("");
        comp.initInput();
        comp.initPicker();
        expect(compPicker.innerHTML).not.toEqual("");
    });

    it("should have an anchor and an icon and a span", () => {
        const comp = document.getElementById('pick1');
        expect(comp).toBeInstanceOf(DateTimePicker);
    });

    it("should have an anchor and an icon and a span", () => {
        const comp = document.getElementById('pick2');
        expect(comp).toBeInstanceOf(DateTimePicker);
    });
});
