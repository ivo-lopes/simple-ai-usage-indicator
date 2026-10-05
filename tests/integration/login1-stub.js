// SPDX-License-Identifier: GPL-3.0-only
// Synthetic login1 responses for a container lab; never connects to host services.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const userPath = '/org/freedesktop/login1/user/_1000';
const sessionPath = '/org/freedesktop/login1/session/_1';
const managerXml = `<node><interface name="org.freedesktop.login1.Manager">
    <method name="GetUser"><arg type="u" direction="in"/><arg type="o" direction="out"/></method>
    <method name="GetSession"><arg type="s" direction="in"/><arg type="o" direction="out"/></method>
    <method name="GetSessionByPID"><arg type="u" direction="in"/><arg type="o" direction="out"/></method>
    <method name="CanSuspend"><arg type="s" direction="out"/></method>
</interface></node>`;
const userXml = `<node><interface name="org.freedesktop.login1.User">
    <property name="Sessions" type="a(so)" access="read"/>
    <property name="State" type="s" access="read"/>
    <property name="Display" type="(so)" access="read"/>
</interface></node>`;
const sessionXml = `<node><interface name="org.freedesktop.login1.Session">
    <property name="Active" type="b" access="read"/>
    <property name="State" type="s" access="read"/>
    <property name="Type" type="s" access="read"/>
    <property name="Class" type="s" access="read"/>
    <property name="IdleHint" type="b" access="read"/>
    <property name="LockedHint" type="b" access="read"/>
</interface></node>`;
const objects = [];
Gio.bus_own_name(Gio.BusType.SYSTEM, 'org.freedesktop.login1', Gio.BusNameOwnerFlags.NONE, bus => {
    const services = [
        [managerXml, {
            GetUser: () => userPath,
            GetSession: () => sessionPath,
            GetSessionByPID: () => sessionPath,
            CanSuspend: () => 'no',
        }, '/org/freedesktop/login1'],
        [userXml, {Sessions: [['1', sessionPath]], State: 'active', Display: ['1', sessionPath]}, userPath],
        [sessionXml, {
            Active: true, State: 'active', Type: 'wayland', Class: 'user',
            IdleHint: false, LockedHint: false,
        }, sessionPath],
    ];
    for (const [xml, service, path] of services) {
        const exported = Gio.DBusExportedObject.wrapJSObject(xml, service);
        exported.export(bus, path);
        objects.push(exported);
    }
}, () => print('READY'), null);
new GLib.MainLoop(null, false).run();
