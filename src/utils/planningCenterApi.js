"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PC_BASE_URL = void 0;
exports.validatePcCredentials = validatePcCredentials;
exports.fetchServiceTypes = fetchServiceTypes;
exports.fetchTemplates = fetchTemplates;
exports.fetchServiceTypeTeams = fetchServiceTypeTeams;
exports.fetchPlans = fetchPlans;
exports.fetchPlanItems = fetchPlanItems;
exports.createPlan = createPlan;
exports.fetchTemplateItems = fetchTemplateItems;
exports.createPlanTime = createPlanTime;
exports.fetchPlanTimes = fetchPlanTimes;
exports.createItem = createItem;
exports.updateItem = updateItem;
exports.deleteItem = deleteItem;
exports.fetchPlanNeededPositionTeamIds = fetchPlanNeededPositionTeamIds;
exports.fetchTeamPositions = fetchTeamPositions;
exports.addNeededPosition = addNeededPosition;
exports.searchSongByCcli = searchSongByCcli;
exports.fetchSongArrangements = fetchSongArrangements;
exports.fetchLastScheduledItem = fetchLastScheduledItem;
exports.createItemNote = createItemNote;
exports.buildPlanTitle = buildPlanTitle;
exports.addSlotAsItem = addSlotAsItem;
exports.fetchAllPeople = fetchAllPeople;
exports.fetchPeopleForTeamPositions = fetchPeopleForTeamPositions;
exports.mapPcPersonToUpsert = mapPcPersonToUpsert;
exports.fetchAndMapPeople = fetchAndMapPeople;
var planningCenterExport_1 = require("@/utils/planningCenterExport");
var esvApi_1 = require("@/utils/esvApi");
/**
 * Base URL for Planning Center API calls.
 * Always uses the /api/planningcenter proxy path.
 * In dev: Vite proxy forwards to the real API.
 * In prod: Firebase Hosting rewrite forwards to a Cloud Function proxy.
 */
exports.PC_BASE_URL = '/api/planningcenter/services/v2';
/**
 * Generate a Basic Auth header from App ID and Secret.
 */
function basicAuthHeader(appId, secret) {
    return 'Basic ' + btoa(appId + ':' + secret);
}
/**
 * Validate PC credentials by making a test API call.
 * Returns {valid: true} on success, {valid: false, error} on failure.
 */
function validatePcCredentials(appId, secret) {
    return __awaiter(this, void 0, Promise, function () {
        var response, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types?per_page=1"), {
                            headers: {
                                Authorization: basicAuthHeader(appId, secret),
                                Accept: 'application/json',
                            },
                        })];
                case 1:
                    response = _b.sent();
                    if (response.status === 401) {
                        return [2 /*return*/, { valid: false, error: 'Invalid credentials' }];
                    }
                    if (!response.ok) {
                        return [2 /*return*/, { valid: false, error: "API error: ".concat(response.status) }];
                    }
                    return [2 /*return*/, { valid: true }];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, { valid: false, error: 'Network error' }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fetch all service types from Planning Center.
 * Returns an array of {id, name} objects.
 */
function fetchServiceTypes(appId, secret) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types?per_page=100"), {
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch service types: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.map(function (st) { return ({ id: st.id, name: st.attributes.name }); })];
            }
        });
    });
}
/**
 * Fetch plan templates for a service type from Planning Center.
 * Returns an array of {id, name} objects.
 */
function fetchTemplates(appId, secret, serviceTypeId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plan_templates?per_page=100"), {
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch templates: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.map(function (t) { return ({ id: t.id, name: t.attributes.name }); })];
            }
        });
    });
}
/**
 * Fetch teams configured for a service type.
 * Returns an array of {id, name} objects.
 */
function fetchServiceTypeTeams(appId, secret, serviceTypeId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/teams?per_page=100"), {
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch teams: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.map(function (t) { return ({ id: t.id, name: t.attributes.name }); })];
            }
        });
    });
}
/**
 * Fetch plans for a service type, optionally filtered to a date range.
 * Returns array of {id, title, sortDate, dates}.
 */
function fetchPlans(appId, secret, serviceTypeId, filter) {
    return __awaiter(this, void 0, Promise, function () {
        var fmtDate, url, afterDate, beforeDate, response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fmtDate = function (d) {
                        return "".concat(d.getFullYear(), "-").concat(String(d.getMonth() + 1).padStart(2, '0'), "-").concat(String(d.getDate()).padStart(2, '0'));
                    };
                    url = "".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans?order=sort_date&per_page=25");
                    if (filter) {
                        afterDate = new Date(filter.after + 'T00:00:00');
                        afterDate.setDate(afterDate.getDate() - 1);
                        beforeDate = new Date(filter.before + 'T00:00:00');
                        beforeDate.setDate(beforeDate.getDate() + 1);
                        url += "&filter=after,before&after=".concat(fmtDate(afterDate), "&before=").concat(fmtDate(beforeDate));
                    }
                    return [4 /*yield*/, fetch(url, {
                            headers: {
                                Authorization: basicAuthHeader(appId, secret),
                                Accept: 'application/json',
                            },
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch plans: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.map(function (p) { return ({
                            id: p.id,
                            title: p.attributes.title,
                            sortDate: p.attributes.sort_date,
                            dates: p.attributes.dates,
                        }); })];
            }
        });
    });
}
/**
 * Fetch existing items from a plan.
 * Returns id, title, sequence, and item_type for each item.
 * item_type is used to distinguish song items ('song', 'song_arrangement') from
 * other regular items ('regular', 'header') when matching for re-export.
 */
function fetchPlanItems(appId, secret, serviceTypeId, planId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/items?per_page=100"), {
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch plan items: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.map(function (item) {
                            var _a;
                            return ({
                                id: item.id,
                                title: item.attributes.title,
                                sequence: item.attributes.sequence,
                                itemType: item.attributes.item_type,
                                length: (_a = item.attributes.length) !== null && _a !== void 0 ? _a : null,
                            });
                        })];
            }
        });
    });
}
/**
 * Create a new plan in Planning Center.
 * Returns the plan ID.
 * Note: PC API only allows title, public, series_title, reminders_disabled on creation.
 * Dates and templates must be handled separately.
 */
function createPlan(appId, secret, serviceTypeId, title) {
    return __awaiter(this, void 0, Promise, function () {
        var response, text, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans"), {
                        method: 'POST',
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            data: {
                                type: 'Plan',
                                attributes: { title: title },
                            },
                        }),
                    })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    text = _a.sent();
                    throw new Error("Failed to create plan: ".concat(response.status, " ").concat(text));
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.id];
            }
        });
    });
}
/**
 * Fetch items from a plan template.
 * GET /service_types/{id}/plan_templates/{templateId}/items
 */
function fetchTemplateItems(appId, secret, serviceTypeId, templateId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plan_templates/").concat(templateId, "/items?per_page=100"), {
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch template items: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.map(function (item) { return ({
                            title: item.attributes.title,
                            itemType: item.attributes.item_type,
                            sequence: item.attributes.sequence,
                            length: item.attributes.length,
                            description: item.attributes.html_details || item.attributes.description,
                        }); })];
            }
        });
    });
}
/**
 * Create a plan time (service time or rehearsal) on a Planning Center plan.
 * POST /service_types/{id}/plans/{planId}/plan_times
 */
function createPlanTime(appId, secret, serviceTypeId, planId, params) {
    return __awaiter(this, void 0, Promise, function () {
        var attributes, response, text, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    attributes = {
                        starts_at: params.startsAt,
                        ends_at: params.endsAt,
                        time_type: params.timeType,
                    };
                    if (params.name) {
                        attributes.name = params.name;
                    }
                    return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/plan_times"), {
                            method: 'POST',
                            headers: {
                                Authorization: basicAuthHeader(appId, secret),
                                Accept: 'application/json',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                data: {
                                    type: 'PlanTime',
                                    attributes: attributes,
                                },
                            }),
                        })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    text = _a.sent();
                    throw new Error("Failed to create plan time: ".concat(response.status, " ").concat(text));
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.id];
            }
        });
    });
}
/**
 * Fetch plan times for a plan.
 * Returns an array of {id, timeType} objects sorted by starts_at.
 * Used to supply the time_id attribute when creating needed_positions.
 */
function fetchPlanTimes(appId, secret, serviceTypeId, planId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/plan_times?order=starts_at"), {
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch plan times: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.map(function (t) { return ({ id: t.id, timeType: t.attributes.time_type }); })];
            }
        });
    });
}
/**
 * Create an item in a Planning Center plan.
 * Returns the item ID.
 *
 * When `arrangementId` is provided, the arrangement relationship is included
 * in the POST body so PC creates a proper song item linked to that arrangement.
 */
function createItem(appId, secret, serviceTypeId, planId, params) {
    return __awaiter(this, void 0, Promise, function () {
        var attributes, data, relationships, response, text, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    attributes = {
                        title: params.title,
                        item_type: params.itemType,
                    };
                    if (params.description) {
                        attributes.html_details = params.description;
                    }
                    if (params.sequence !== undefined) {
                        attributes.sequence = params.sequence;
                    }
                    if (params.length !== undefined) {
                        attributes.length = params.length;
                    }
                    data = {
                        type: 'Item',
                        attributes: attributes,
                    };
                    relationships = {};
                    if (params.songId) {
                        relationships.song = {
                            data: { type: 'Song', id: params.songId },
                        };
                    }
                    if (params.arrangementId) {
                        relationships.arrangement = {
                            data: { type: 'Arrangement', id: params.arrangementId },
                        };
                    }
                    if (Object.keys(relationships).length > 0) {
                        data.relationships = relationships;
                    }
                    return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/items"), {
                            method: 'POST',
                            headers: {
                                Authorization: basicAuthHeader(appId, secret),
                                Accept: 'application/json',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ data: data }),
                        })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    text = _a.sent();
                    throw new Error("Failed to create item: ".concat(response.status, " ").concat(text));
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.id];
            }
        });
    });
}
/**
 * Update an existing item in a Planning Center plan.
 * PATCH /service_types/{id}/plans/{planId}/items/{itemId}
 */
function updateItem(appId, secret, serviceTypeId, planId, itemId, params) {
    return __awaiter(this, void 0, Promise, function () {
        var attributes, response, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    attributes = {};
                    if (params.title !== undefined) {
                        attributes.title = params.title;
                    }
                    if (params.itemType !== undefined) {
                        attributes.item_type = params.itemType;
                    }
                    if (params.description !== undefined) {
                        attributes.html_details = params.description;
                    }
                    if (params.length !== undefined) {
                        attributes.length = params.length;
                    }
                    return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/items/").concat(itemId), {
                            method: 'PATCH',
                            headers: {
                                Authorization: basicAuthHeader(appId, secret),
                                Accept: 'application/json',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                data: {
                                    type: 'Item',
                                    id: itemId,
                                    attributes: attributes,
                                },
                            }),
                        })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    text = _a.sent();
                    throw new Error("Failed to update item: ".concat(response.status, " ").concat(text));
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Delete an item from a plan.
 */
function deleteItem(appId, secret, serviceTypeId, planId, itemId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/items/").concat(itemId), {
                        method: 'DELETE',
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    text = _a.sent();
                    throw new Error("Failed to delete item: ".concat(response.status, " ").concat(text));
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fetch team IDs that already have needed_positions on a plan.
 * Used before adding teams to avoid duplicates on re-export.
 */
function fetchPlanNeededPositionTeamIds(appId, secret, serviceTypeId, planId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json, ids, _i, _a, pos, teamId;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/needed_positions?include=team&per_page=100"), {
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _e.sent();
                    if (!response.ok)
                        return [2 /*return*/, new Set()];
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_e.sent());
                    ids = new Set();
                    for (_i = 0, _a = json.data; _i < _a.length; _i++) {
                        pos = _a[_i];
                        teamId = (_d = (_c = (_b = pos.relationships) === null || _b === void 0 ? void 0 : _b.team) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.id;
                        if (teamId)
                            ids.add(teamId);
                    }
                    return [2 /*return*/, ids];
            }
        });
    });
}
/**
 * Fetch positions configured for a team.
 * PC requires a valid team_position_id to create a NeededPosition.
 * Returns [] for teams with no positions — those teams cannot get needed_positions.
 */
function fetchTeamPositions(appId, secret, teamId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/teams/").concat(teamId, "/team_positions?per_page=100"), {
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.map(function (p) { return ({ id: p.id, name: p.attributes.name }); })];
            }
        });
    });
}
/**
 * Add a team to a plan by creating one NeededPosition per team position.
 *
 * Teams appear in a PC plan's schedule section when they have needed_positions.
 * PC requires the team_position relationship — you cannot create a needed_position
 * without referencing a specific position within the team.
 *
 * Creates one unfilled slot per position; slots can be filled later in the PC UI.
 */
function addNeededPosition(appId, secret, serviceTypeId, planId, teamId, teamPositionId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/needed_positions"), {
                        method: 'POST',
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            data: {
                                type: 'NeededPosition',
                                attributes: {
                                    quantity: 1,
                                },
                                relationships: {
                                    team: {
                                        data: { type: 'Team', id: teamId },
                                    },
                                    team_position: {
                                        data: { type: 'TeamPosition', id: teamPositionId },
                                    },
                                },
                            },
                        }),
                    })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    text = _a.sent();
                    throw new Error("Failed to add position ".concat(teamPositionId, " for team ").concat(teamId, ": ").concat(response.status, " ").concat(text));
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Search Planning Center for a song by CCLI number.
 * Returns {id, title} of the first match, or null if not found.
 * Non-critical lookup — returns null on any error.
 */
function searchSongByCcli(appId, secret, ccliNumber) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json, first, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/songs?where[ccli_number]=").concat(ccliNumber), {
                            headers: {
                                Authorization: basicAuthHeader(appId, secret),
                                Accept: 'application/json',
                            },
                        })];
                case 1:
                    response = _b.sent();
                    if (!response.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_b.sent());
                    first = json.data[0];
                    if (!first)
                        return [2 /*return*/, null];
                    return [2 /*return*/, { id: first.id, title: first.attributes.title }];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fetch arrangements for a Planning Center song.
 * Returns array of {id, name, key}. Returns empty array on error.
 */
function fetchSongArrangements(appId, secret, pcSongId) {
    return __awaiter(this, void 0, Promise, function () {
        var headers, url, _loop_1, attempt, state_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = {
                        Authorization: basicAuthHeader(appId, secret),
                        Accept: 'application/json',
                    };
                    url = "".concat(exports.PC_BASE_URL, "/songs/").concat(pcSongId, "/arrangements?per_page=25");
                    _loop_1 = function (attempt) {
                        var response, retryAfter, waitMs_1, json, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 5, , 6]);
                                    return [4 /*yield*/, fetch(url, { headers: headers })];
                                case 1:
                                    response = _c.sent();
                                    if (!(response.status === 429)) return [3 /*break*/, 3];
                                    retryAfter = response.headers.get('Retry-After');
                                    waitMs_1 = retryAfter ? parseFloat(retryAfter) * 1000 : 60000;
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, waitMs_1); })];
                                case 2:
                                    _c.sent();
                                    return [2 /*return*/, "continue"];
                                case 3:
                                    if (!response.ok)
                                        return [2 /*return*/, { value: [] }];
                                    return [4 /*yield*/, response.json()];
                                case 4:
                                    json = (_c.sent());
                                    return [2 /*return*/, { value: json.data.map(function (a) {
                                                var _a;
                                                return ({
                                                    id: a.id,
                                                    name: a.attributes.name,
                                                    key: (_a = a.attributes.chord_chart_key) !== null && _a !== void 0 ? _a : '',
                                                });
                                            }) }];
                                case 5:
                                    _b = _c.sent();
                                    return [2 /*return*/, { value: [] }];
                                case 6: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _a.label = 1;
                case 1:
                    if (!(attempt < 4)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, []];
            }
        });
    });
}
/**
 * Fetch the last scheduled item for a PC song, including its item_notes.
 * Uses song_schedules to find the most recent usage, then fetches that item.
 * Returns null when the song has no prior schedule history or on any error.
 */
function fetchLastScheduledItem(appId, secret, pcSongId) {
    return __awaiter(this, void 0, Promise, function () {
        var scheduleResponse, scheduleJson, schedule, itemId, planId, serviceTypeId, itemResponse, itemJson, notes, arrangementId, _a;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/songs/").concat(pcSongId, "/song_schedules?filter=three_most_recent&order=-plan_sort_date&per_page=1"), {
                            headers: {
                                Authorization: basicAuthHeader(appId, secret),
                                Accept: 'application/json',
                            },
                        })];
                case 1:
                    scheduleResponse = _g.sent();
                    if (!scheduleResponse.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, scheduleResponse.json()];
                case 2:
                    scheduleJson = (_g.sent());
                    schedule = scheduleJson.data[0];
                    if (!schedule)
                        return [2 /*return*/, null];
                    itemId = schedule.relationships.item.data.id;
                    planId = schedule.relationships.plan.data.id;
                    serviceTypeId = schedule.relationships.service_type.data.id;
                    return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/items/").concat(itemId, "?include=item_notes"), {
                            headers: {
                                Authorization: basicAuthHeader(appId, secret),
                                Accept: 'application/json',
                            },
                        })];
                case 3:
                    itemResponse = _g.sent();
                    if (!itemResponse.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, itemResponse.json()];
                case 4:
                    itemJson = (_g.sent());
                    notes = ((_b = itemJson.included) !== null && _b !== void 0 ? _b : [])
                        .filter(function (inc) { var _a; return inc.type === 'ItemNote' && ((_a = inc.attributes.content) === null || _a === void 0 ? void 0 : _a.trim()); })
                        .map(function (inc) { return ({
                        categoryId: inc.relationships.item_note_category.data.id,
                        content: inc.attributes.content,
                    }); });
                    arrangementId = (_f = (_e = (_d = (_c = itemJson.data.relationships) === null || _c === void 0 ? void 0 : _c.arrangement) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.id) !== null && _f !== void 0 ? _f : null;
                    return [2 /*return*/, { notes: notes, arrangementId: arrangementId }];
                case 5:
                    _a = _g.sent();
                    return [2 /*return*/, null];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Create an item note on a Planning Center plan item.
 * POST /service_types/{stId}/plans/{planId}/items/{itemId}/item_notes
 * 422 errors are expected when PC already has a note for that category — ignored by caller.
 */
function createItemNote(appId, secret, serviceTypeId, planId, itemId, categoryId, content) {
    return __awaiter(this, void 0, Promise, function () {
        var response, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/service_types/").concat(serviceTypeId, "/plans/").concat(planId, "/items/").concat(itemId, "/item_notes"), {
                        method: 'POST',
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            data: {
                                type: 'ItemNote',
                                attributes: {
                                    item_note_category_id: categoryId,
                                    content: content,
                                },
                            },
                        }),
                    })];
                case 1:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    text = _a.sent();
                    throw new Error("Failed to create item note: ".concat(response.status, " ").concat(text));
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Build a plan title from a service.
 * Format: "Sermon Scripture (Teams)" or "Service Name" or "Service" as fallback.
 */
function buildPlanTitle(service) {
    var base;
    if (service.sermonPassage) {
        base = (0, planningCenterExport_1.formatScriptureRef)(service.sermonPassage);
    }
    else if (service.name && service.name.trim() !== '') {
        base = service.name.trim();
    }
    else {
        base = 'Service';
    }
    if (service.teams && service.teams.length > 0) {
        return "".concat(base, " (").concat(service.teams.join(', '), ")");
    }
    return base;
}
/**
 * Add a service slot as a Planning Center item.
 * Maps each SlotKind to the appropriate item type and attributes.
 */
function addSlotAsItem(appId, secret, serviceTypeId, planId, slot, sequence, songs, sermonPassage, length) {
    return __awaiter(this, void 0, Promise, function () {
        var title, pcSongId, arrangementId, lastItemNotes, song, pcSong, arrangements, lastItem, _a, newItemId, _i, lastItemNotes_1, note, _b, numPart, versesPart, title, verseRange, refText, title, description_1, _c, description;
        var _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    if (!(slot.kind === 'SONG')) return [3 /*break*/, 15];
                    // Skip empty song slots (no songId assigned)
                    if (!slot.songId) {
                        return [2 /*return*/, ''];
                    }
                    title = "Worship Song - ".concat((_d = slot.songTitle) !== null && _d !== void 0 ? _d : '[Empty Song]');
                    pcSongId = void 0;
                    arrangementId = void 0;
                    lastItemNotes = [];
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 6, , 7]);
                    song = songs.find(function (s) { return s.id === slot.songId; });
                    if (!(song && song.ccliNumber)) return [3 /*break*/, 5];
                    return [4 /*yield*/, searchSongByCcli(appId, secret, song.ccliNumber)];
                case 2:
                    pcSong = _g.sent();
                    if (!pcSong) return [3 /*break*/, 5];
                    pcSongId = pcSong.id;
                    return [4 /*yield*/, fetchSongArrangements(appId, secret, pcSong.id)];
                case 3:
                    arrangements = _g.sent();
                    if (arrangements.length > 0 && arrangements[0]) {
                        arrangementId = arrangements[0].id;
                    }
                    return [4 /*yield*/, fetchLastScheduledItem(appId, secret, pcSong.id)];
                case 4:
                    lastItem = _g.sent();
                    if (lastItem) {
                        lastItemNotes = lastItem.notes;
                    }
                    _g.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    _a = _g.sent();
                    return [3 /*break*/, 7];
                case 7: return [4 /*yield*/, createItem(appId, secret, serviceTypeId, planId, {
                        title: title,
                        itemType: pcSongId ? 'song' : 'song_arrangement',
                        sequence: sequence,
                        length: length,
                        songId: pcSongId,
                        arrangementId: arrangementId,
                    })
                    // Copy item notes (per category) from last scheduled item
                ];
                case 8:
                    newItemId = _g.sent();
                    _i = 0, lastItemNotes_1 = lastItemNotes;
                    _g.label = 9;
                case 9:
                    if (!(_i < lastItemNotes_1.length)) return [3 /*break*/, 14];
                    note = lastItemNotes_1[_i];
                    _g.label = 10;
                case 10:
                    _g.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, createItemNote(appId, secret, serviceTypeId, planId, newItemId, note.categoryId, note.content)];
                case 11:
                    _g.sent();
                    return [3 /*break*/, 13];
                case 12:
                    _b = _g.sent();
                    return [3 /*break*/, 13];
                case 13:
                    _i++;
                    return [3 /*break*/, 9];
                case 14: return [2 /*return*/, newItemId];
                case 15:
                    if (slot.kind === 'HYMN') {
                        numPart = slot.hymnNumber ? " #".concat(slot.hymnNumber) : '';
                        versesPart = slot.verses ? " (vv. ".concat(slot.verses, ")") : '';
                        title = "Worship Song - ".concat(slot.hymnName).concat(numPart).concat(versesPart);
                        return [2 /*return*/, createItem(appId, secret, serviceTypeId, planId, {
                                title: title,
                                itemType: 'song_arrangement',
                                sequence: sequence,
                                length: length,
                            })];
                    }
                    if (!(slot.kind === 'SCRIPTURE')) return [3 /*break*/, 20];
                    verseRange = slot.verseStart && slot.verseEnd ? ":".concat(slot.verseStart, "-").concat(slot.verseEnd) : '';
                    refText = "".concat((_e = slot.book) !== null && _e !== void 0 ? _e : '', " ").concat((_f = slot.chapter) !== null && _f !== void 0 ? _f : '').concat(verseRange).trim();
                    title = "Scripture - ".concat(refText);
                    _g.label = 16;
                case 16:
                    _g.trys.push([16, 18, , 19]);
                    return [4 /*yield*/, (0, esvApi_1.fetchPassageText)(refText)];
                case 17:
                    description_1 = _g.sent();
                    return [3 /*break*/, 19];
                case 18:
                    _c = _g.sent();
                    return [3 /*break*/, 19];
                case 19: return [2 /*return*/, createItem(appId, secret, serviceTypeId, planId, {
                        title: title,
                        itemType: 'regular',
                        description: description_1,
                        sequence: sequence,
                        length: length,
                    })];
                case 20:
                    if (slot.kind === 'PRAYER') {
                        return [2 /*return*/, createItem(appId, secret, serviceTypeId, planId, {
                                title: 'Prayer',
                                itemType: 'regular',
                                sequence: sequence,
                            })];
                    }
                    description = sermonPassage ? (0, planningCenterExport_1.formatScriptureRef)(sermonPassage) : undefined;
                    return [2 /*return*/, createItem(appId, secret, serviceTypeId, planId, {
                            title: 'Message',
                            itemType: 'regular',
                            description: description,
                            sequence: sequence,
                        })];
            }
        });
    });
}
/**
 * Fetch all people from Planning Center Services v2, following pagination via links.next.
 * Mirrors fetchAllPcSongs's pagination + 429-retry + proxy-URL-rewrite pattern
 * (src/utils/pcSongImport.ts).
 *
 * Do NOT add any phone-number related include or nested resource fetch here — Services v2
 * has no such vertex and it would 404 (RESEARCH.md Pitfall 5 / Assumption A1). Phone is an
 * app-only field (D-14), always set to '' by mapPcPersonToUpsert.
 */
function fetchAllPeople(appId, secret) {
    return __awaiter(this, void 0, Promise, function () {
        var authHeader, url, allPeople, response, _loop_2, attempt, state_2, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    authHeader = basicAuthHeader(appId, secret);
                    url = "".concat(exports.PC_BASE_URL, "/people?per_page=100");
                    allPeople = [];
                    _a.label = 1;
                case 1:
                    if (!url) return [3 /*break*/, 7];
                    response = void 0;
                    _loop_2 = function (attempt) {
                        var retryAfter, waitMs;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, fetch(url, {
                                        headers: { Authorization: authHeader, Accept: 'application/json' },
                                    })];
                                case 1:
                                    response = _b.sent();
                                    if (response.status !== 429 || attempt >= 3)
                                        return [2 /*return*/, "break"];
                                    retryAfter = response.headers.get('Retry-After');
                                    waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 60000;
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, waitMs); })];
                                case 2:
                                    _b.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _a.label = 2;
                case 2: return [5 /*yield**/, _loop_2(attempt)];
                case 3:
                    state_2 = _a.sent();
                    if (state_2 === "break")
                        return [3 /*break*/, 5];
                    _a.label = 4;
                case 4:
                    attempt++;
                    return [3 /*break*/, 2];
                case 5:
                    if (!response.ok) {
                        throw new Error("Failed to fetch people: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 6:
                    json = (_a.sent());
                    allPeople.push.apply(allPeople, json.data);
                    // Follow pagination — rewrite absolute PC URL to local proxy path
                    if (json.links.next) {
                        url = json.links.next.replace('https://api.planningcenteronline.com/services/v2', exports.PC_BASE_URL);
                    }
                    else {
                        url = undefined;
                    }
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, allPeople];
            }
        });
    });
}
/**
 * Fetch the distinct people currently serving one of the caller's selected team positions
 * (D-08/D-09/D-10 — selective import scoped by team AND role/position). Uses the team-scoped
 * `/teams/{teamId}/person_team_position_assignments?include=person` endpoint (NOT the
 * service_type-scoped sibling — RESEARCH.md Pitfall 4) so the included Person resources are
 * returned inline, avoiding an N+1 per-person fetch. Mirrors fetchAllPeople's pagination +
 * 429-retry + proxy-URL-rewrite loop.
 *
 * Choir/orchestra positions are excluded simply by never being in `selectedPositionIds` (D-09).
 * Emails are NOT fetched here — that is Plan 04's concern if/when needed downstream.
 */
function fetchPeopleForTeamPositions(appId, secret, teamId, selectedPositionIds) {
    return __awaiter(this, void 0, Promise, function () {
        var authHeader, url, peopleById, response, _loop_3, attempt, state_3, json, includedById, _i, _a, assignment, posId, personId, person, name, entries, BATCH_SIZE, result, i, batch, mapped;
        var _this = this;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    authHeader = basicAuthHeader(appId, secret);
                    url = "".concat(exports.PC_BASE_URL, "/teams/").concat(teamId, "/person_team_position_assignments?include=person&per_page=100");
                    peopleById = new Map() // pcPersonId -> name
                    ;
                    _f.label = 1;
                case 1:
                    if (!url) return [3 /*break*/, 7];
                    response = void 0;
                    _loop_3 = function (attempt) {
                        var retryAfter, waitMs;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0: return [4 /*yield*/, fetch(url, {
                                        headers: { Authorization: authHeader, Accept: 'application/json' },
                                    })];
                                case 1:
                                    response = _g.sent();
                                    if (response.status !== 429 || attempt >= 3)
                                        return [2 /*return*/, "break"];
                                    retryAfter = response.headers.get('Retry-After');
                                    waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 60000;
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, waitMs); })];
                                case 2:
                                    _g.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _f.label = 2;
                case 2: return [5 /*yield**/, _loop_3(attempt)];
                case 3:
                    state_3 = _f.sent();
                    if (state_3 === "break")
                        return [3 /*break*/, 5];
                    _f.label = 4;
                case 4:
                    attempt++;
                    return [3 /*break*/, 2];
                case 5:
                    if (!response.ok) {
                        throw new Error("Failed to fetch team position assignments: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 6:
                    json = (_f.sent());
                    includedById = new Map(((_b = json.included) !== null && _b !== void 0 ? _b : []).map(function (p) { return [p.id, p]; }));
                    for (_i = 0, _a = json.data; _i < _a.length; _i++) {
                        assignment = _a[_i];
                        posId = assignment.relationships.team_position.data.id;
                        if (!selectedPositionIds.has(posId))
                            continue;
                        personId = assignment.relationships.person.data.id;
                        person = includedById.get(personId);
                        if (!person)
                            continue;
                        name = ((_c = person.attributes.name) === null || _c === void 0 ? void 0 : _c.trim()) ||
                            "".concat((_d = person.attributes.first_name) !== null && _d !== void 0 ? _d : '', " ").concat((_e = person.attributes.last_name) !== null && _e !== void 0 ? _e : '').trim();
                        peopleById.set(personId, name); // dedupes people serving multiple selected positions
                    }
                    // Follow pagination — rewrite absolute PC URL to local proxy path
                    if (json.links.next) {
                        url = json.links.next.replace('https://api.planningcenteronline.com/services/v2', exports.PC_BASE_URL);
                    }
                    else {
                        url = undefined;
                    }
                    return [3 /*break*/, 1];
                case 7:
                    entries = Array.from(peopleById, function (_a) {
                        var pcPersonId = _a[0], name = _a[1];
                        return ({ pcPersonId: pcPersonId, name: name });
                    });
                    BATCH_SIZE = 3;
                    result = [];
                    i = 0;
                    _f.label = 8;
                case 8:
                    if (!(i < entries.length)) return [3 /*break*/, 11];
                    batch = entries.slice(i, i + BATCH_SIZE);
                    return [4 /*yield*/, Promise.all(batch.map(function (entry) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            var _b;
                            var _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _a = [__assign({}, entry)];
                                        _b = {};
                                        return [4 /*yield*/, fetchPersonEmails(appId, secret, entry.pcPersonId)];
                                    case 1: return [2 /*return*/, (__assign.apply(void 0, _a.concat([(_b.email = (_c = (_d.sent())[0]) !== null && _c !== void 0 ? _c : '', _b)])))];
                                }
                            });
                        }); }))];
                case 9:
                    mapped = _f.sent();
                    result.push.apply(result, mapped);
                    _f.label = 10;
                case 10:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 8];
                case 11: return [2 /*return*/, result];
            }
        });
    });
}
/**
 * Pure: PC person + its resolved emails → UpsertPersonInput.
 * `phone` is ALWAYS '' — PC Services v2 has no phone vertex (D-14 app-only field,
 * RESEARCH.md Pitfall 5). Standing fields (active/roles) are left to the
 * store's upsert defaults and intentionally omitted here.
 */
function mapPcPersonToUpsert(person, emails) {
    var _a, _b, _c;
    var attributes = person.attributes;
    var name = attributes.name && attributes.name.trim() !== ''
        ? attributes.name
        : "".concat((_a = attributes.first_name) !== null && _a !== void 0 ? _a : '', " ").concat((_b = attributes.last_name) !== null && _b !== void 0 ? _b : '').trim();
    return {
        name: name,
        email: (_c = emails[0]) !== null && _c !== void 0 ? _c : '',
        phone: '', // PC Services v2 has no phone vertex — D-14 app-only field
        pcPersonId: person.id,
    };
}
/**
 * Fetch a person's emails from the nested Services v2 endpoint.
 * Returns the `address` attribute for each email, or [] on a non-ok response.
 */
function fetchPersonEmails(appId, secret, personId) {
    return __awaiter(this, void 0, Promise, function () {
        var response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(exports.PC_BASE_URL, "/people/").concat(personId, "/emails"), {
                        headers: {
                            Authorization: basicAuthHeader(appId, secret),
                            Accept: 'application/json',
                        },
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    return [2 /*return*/, json.data.map(function (e) { return e.attributes.address; })];
            }
        });
    });
}
/**
 * Orchestrator: fetch all PC people, then fetch each person's emails (batched by 3 to
 * respect PC rate limits, mirroring fetchAndMapPcSongs's arrangement-batching), map, and
 * return a preview-ready UpsertPersonInput[] without writing to Firestore.
 */
function fetchAndMapPeople(appId, secret) {
    return __awaiter(this, void 0, Promise, function () {
        var people, BATCH_SIZE, results, i, batch, mappedBatch;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchAllPeople(appId, secret)];
                case 1:
                    people = _a.sent();
                    BATCH_SIZE = 3;
                    results = [];
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < people.length)) return [3 /*break*/, 5];
                    batch = people.slice(i, i + BATCH_SIZE);
                    return [4 /*yield*/, Promise.all(batch.map(function (person) { return __awaiter(_this, void 0, void 0, function () {
                            var emails;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetchPersonEmails(appId, secret, person.id)];
                                    case 1:
                                        emails = _a.sent();
                                        return [2 /*return*/, mapPcPersonToUpsert(person, emails)];
                                }
                            });
                        }); }))];
                case 3:
                    mappedBatch = _a.sent();
                    results.push.apply(results, mappedBatch);
                    _a.label = 4;
                case 4:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, results];
            }
        });
    });
}
