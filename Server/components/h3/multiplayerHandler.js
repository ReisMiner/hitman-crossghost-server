// Copyright (C) 2020-2021 grappigegovert <grappigegovert@hotmail.com>
// Licensed under the zlib license. See LICENSE for more info

const express = require('express');
const path = require('path');
const uuid = require('uuid');
const { readFile } = require('atomically');

const eventHandler = require('./eventHandler.js');
const { generateUserCentricMultiple } = require('./menuData.js');

const app = express.Router();

app.post('/GetRequiredResourcesForPreset', express.json(), async (req, res) => {
    const allPresets = JSON.parse(await readFile(path.join('menudata', 'h3', 'menudata', 'multiplayerpresets.json')));
    const requestedPreset = allPresets.find(preset => preset.Id === req.body.id);
    if (!requestedPreset) {
        res.status(404).end();
        console.info('unknown multiplayer preset id requested');
        return;
    }

    const userData = JSON.parse(await readFile(path.join('userdata', req.gameVersion, 'users', `${req.jwt.unique_name}.json`)));
    const contractIds = requestedPreset.Data.Contracts;
    const userCentrics = await generateUserCentricMultiple(contractIds, userData, req.gameVersion);

    res.json(userCentrics.map(userCentric => ({
        Id: userCentric.Contract.Metadata.Id,
        DlcId: userCentric.Data.DlcName,
        Resources: [userCentric.Contract.Metadata.ScenePath, ...userCentric.Contract.Data.Bricks],
    })));
});

// Matches are only referenced by id from the game, so they used to live forever.
// Bound them: idle matches expire, and the count, players and data are capped.
const MATCH_IDLE_MS = 6 * 60 * 60 * 1000; // like a room's maximum age
const MAX_MATCHES = 2000;
const MAX_MATCH_PLAYERS = 8; // Ghost Mode uses 2
const MAX_MATCH_DATA_BYTES = 16 * 1024;
let activeMatches = new Map();

function cleanupMatches(now = Date.now()) {
    for (const [matchId, match] of activeMatches) {
        if (now - match.lastActivity > MATCH_IDLE_MS) activeMatches.delete(matchId);
    }
}

app.post('/RegisterToMatch', express.json(), async (req, res) => {
    console.log('RegisterToMatch request', JSON.stringify(req.body));
    // get a random contract from the list of possible ones in the selected preset
    let multiplayerPresets = JSON.parse(await readFile(path.join('menudata', 'h3', 'menudata', 'multiplayerpresets.json')));
    if (!req.body.presetId) {
        req.body.presetId = 'd72d7cc9-ee26-4c7d-857a-75abdc9ccb61'; // default to miami invite preset
    }
    let preset = multiplayerPresets.find(preset => preset.Id === req.body.presetId);
    if (!preset) {
        res.status(404).end();
        console.info('unknown multiplayer preset id requested');
        return;
    }

    let contractId = preset.Data.Contracts[Math.trunc(Math.random() * preset.Data.Contracts.length)];

    if (req.body.matchId === uuid.NIL) { // create new match
        if (activeMatches.size >= MAX_MATCHES) cleanupMatches();
        if (activeMatches.size >= MAX_MATCHES) {
            console.warn('RegisterToMatch: match limit reached');
            res.status(503).end();
            return;
        }
        req.body.matchId = uuid.v4();
        activeMatches.set(req.body.matchId, {
            MatchData: {
                contractId: contractId,
            },
            Players: [req.jwt.unique_name],
            lastActivity: Date.now(),
        });
    } else if (activeMatches.has(req.body.matchId)) { // join existing match
        let match = activeMatches.get(req.body.matchId);
        const rejoin = match.Players.includes(req.jwt.unique_name);
        if (!rejoin && match.Players.length >= MAX_MATCH_PLAYERS) {
            res.status(409).end(); // match is full
            return;
        }
        match.Players.forEach(playerId => eventHandler.enqueuePushMessage(playerId, {
            MatchId: req.body.matchId,
            Type: 1,
            PlayerId: req.jwt.unique_name,
            MatchData: null
        }));
        // A re-register used to add a duplicate, so every later join notified it twice.
        if (!rejoin) match.Players.push(req.jwt.unique_name);
        match.lastActivity = Date.now();
    } else { // MatchId not found
        res.status(404).end();
        return;
    }

    eventHandler.enqueuePushMessage(req.jwt.unique_name, {
        MatchId: req.body.matchId,
        Type: 3,
        PlayerId: uuid.NIL,
        MatchData: activeMatches.get(req.body.matchId).MatchData,
    });

    res.json({
        MatchId: req.body.matchId,
        PreferedHostIndex: 0,
        Tickets: [],
        MatchMode: null,
        MatchData: null,
        MatchStats: {},
        MatchType: 0
    });
    console.log('RegisterToMatch response', JSON.stringify({ matchId: req.body.matchId, players: activeMatches.get(req.body.matchId)?.Players }));
});

app.post('/SetMatchData', express.json(), (req, res) => {
    console.log('SetMatchData request', JSON.stringify(req.body));
    let match = activeMatches.get(req.body.matchId)
    if (match && match.Players.includes(req.jwt.unique_name)) {
        const key = req.body.key;
        if (typeof key !== 'string' || !key || key.length > 256 || key === '__proto__') {
            res.status(400).end();
            return;
        }
        const hadKey = Object.hasOwn(match.MatchData, key);
        const previous = match.MatchData[key];
        match.MatchData[key] = req.body.value;
        if (JSON.stringify(match.MatchData).length > MAX_MATCH_DATA_BYTES) {
            if (hadKey) match.MatchData[key] = previous;
            else delete match.MatchData[key];
            res.status(413).end();
            return;
        }
        match.lastActivity = Date.now();
        res.json({
            MatchId: req.body.matchId,
            PreferedHostIndex: 0,
            Tickets: [],
            MatchMode: null,
            MatchData: match.MatchData,
            MatchStats: {},
            MatchType: 0
        });
    } else {
        res.status(404).end();
    }
});

app.post('/RegisterToPreset', express.json(), (req, res) => { // matchmaking
    console.log('RegisterToPreset request', JSON.stringify(req.body));
    // TODO: implement matchmaking
    // req.body.presetId
    // req.body.lobbyId (this is just a timestamp?)
    res.status(501).end();
});

app.cleanupMatches = cleanupMatches;

module.exports = app;
