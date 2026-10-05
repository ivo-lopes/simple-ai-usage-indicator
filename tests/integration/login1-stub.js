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
    // libgnome-desktop 45/47 dereferences a missing localed layout in minimal containers.
    Gio.bus_own_name_on_connection(bus, 'org.freedesktop.locale1', Gio.BusNameOwnerFlags.NONE, null, null);
    const services = [
        [`<node><interface name="org.freedesktop.locale1">
            <property name="Locale" type="as" access="read"/>
            <property name="X11Layout" type="s" access="read"/>
            <property name="X11Model" type="s" access="read"/>
            <property name="X11Variant" type="s" access="read"/>
            <property name="X11Options" type="s" access="read"/>
        </interface></node>`, {Locale: ['LANG=en_US.UTF-8'], X11Layout: 'us', X11Model: 'pc105',
            X11Variant: '', X11Options: ''}, '/org/freedesktop/locale1'],
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
    // Older Shells require AccountsService user data even in a headless session.
    const accountPath = '/org/freedesktop/Accounts/User1000';
    const accountValues = {
        Uid: ['t', 1000], UserName: ['s', GLib.get_user_name()], RealName: ['s', 'SAUI laboratory'],
        AccountType: ['i', 0], HomeDirectory: ['s', GLib.get_home_dir()], Shell: ['s', '/bin/bash'],
        Email: ['s', ''], Language: ['s', 'en_US.UTF-8'], Languages: ['as', []],
        Session: ['s', 'gnome'], SessionType: ['s', 'wayland'], XSession: ['s', 'gnome'],
        Location: ['s', ''], LoginFrequency: ['t', 1], LoginTime: ['x', 0], LoginHistory: ['a(xxa{sv})', []],
        IconFile: ['s', ''], Saved: ['b', true], Locked: ['b', false], PasswordMode: ['i', 0],
        PasswordHint: ['s', ''], AutomaticLogin: ['b', false], SystemAccount: ['b', false], LocalAccount: ['b', true],
    };
    const accountXml = '<node><interface name="org.freedesktop.Accounts.User">' +
        Object.entries(accountValues).map(([name, [type]]) =>
            `<property name="${name}" type="${type}" access="read"/>`).join('') + '</interface></node>';
    services.push([accountXml, Object.fromEntries(Object.entries(accountValues).map(([name, [, value]]) => [name, value])), accountPath]);
    services.push([`<node><interface name="org.freedesktop.Accounts">
        <method name="FindUserByName"><arg type="s" direction="in"/><arg type="o" direction="out"/></method>
        <method name="FindUserById"><arg type="x" direction="in"/><arg type="o" direction="out"/></method>
        <method name="ListCachedUsers"><arg type="ao" direction="out"/></method>
        <property name="HasNoUsers" type="b" access="read"/>
        <property name="HasMultipleUsers" type="b" access="read"/>
        <property name="AutomaticLoginUsers" type="ao" access="read"/>
    </interface></node>`, {
        FindUserByName: () => accountPath, FindUserById: () => accountPath, ListCachedUsers: () => [accountPath],
        HasNoUsers: false, HasMultipleUsers: false, AutomaticLoginUsers: [],
    }, '/org/freedesktop/Accounts']);
    Gio.bus_own_name_on_connection(bus, 'org.freedesktop.Accounts', Gio.BusNameOwnerFlags.NONE, null, null);
    for (const [xml, service, path] of services) {
        const exported = Gio.DBusExportedObject.wrapJSObject(xml, service);
        exported.export(bus, path);
        objects.push(exported);
    }
}, () => print('READY'), null);
new GLib.MainLoop(null, false).run();
