import Map "mo:core/Map";
import List "mo:core/List";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Nat16 "mo:core/Nat16";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Blob "mo:core/Blob";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // ── HTTP types ────────────────────────────────────────────────────────────
  public type HttpRequest = {
    method : Text;
    url : Text;
    headers : [(Text, Text)];
    body : Blob;
  };

  public type HttpResponse = {
    status_code : Nat16;
    headers : [(Text, Text)];
    body : Blob;
    upgrade : ?Bool;
  };

  // ── Existing types ────────────────────────────────────────────────────────
  module UploadHistoryEntry {
    public func compare(a : UploadHistoryEntry, b : UploadHistoryEntry) : Order.Order {
      Nat.compare(a.id, b.id);
    };
  };

  public type OAuthConfig = {
    clientId : Text;
    clientSecret : Text;
    refreshToken : Text;
    driveFolderId : Text;
  };

  public type QueueItem = {
    driveFileId : Text;
    fileName : Text;
    orderIndex : Nat;
  };

  public type UploadHistoryEntry = {
    id : Nat;
    driveFileId : Text;
    fileName : Text;
    youtubeVideoId : Text;
    uploadedAt : Int;
    status : Text;
    errorMessage : Text;
  };

  public type SchedulerState = {
    isEnabled : Bool;
    uploadsToday : Nat;
    lastUploadDate : Text;
    lastUploadTime : Int;
  };

  public type UserProfile = {
    name : Text;
  };

  public type ChannelConfig = {
    clientId : Text;
    clientSecret : Text;
    refreshToken : Text;
    driveFolderId : Text;
    title : Text;
    caption : Text;
  };

  // ── State ─────────────────────────────────────────────────────────────────
  var oAuthConfig : ?OAuthConfig = null;
  let uploadQueue = List.empty<QueueItem>();
  let history = Map.empty<Nat, UploadHistoryEntry>();
  var nextHistoryId = 1;
  var schedulerState : SchedulerState = {
    isEnabled = true;
    uploadsToday = 0;
    lastUploadDate = "";
    lastUploadTime = 0;
  };
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Per-channel config and trigger storage
  let channelConfigs = Map.empty<Text, ChannelConfig>();
  let pendingTriggers = Map.empty<Text, Int>(); // channelId -> trigger timestamp

  // ── Helpers ───────────────────────────────────────────────────────────────
  func jsonOk(body : Text) : HttpResponse {
    {
      status_code = 200;
      headers = [("Content-Type", "application/json"), ("Access-Control-Allow-Origin", "*")];
      body = body.encodeUtf8();
      upgrade = null;
    }
  };

  func jsonErr(code : Nat16, msg : Text) : HttpResponse {
    {
      status_code = code;
      headers = [("Content-Type", "application/json"), ("Access-Control-Allow-Origin", "*")];
      body = ("{\'error\':\'" # msg # "\'}").encodeUtf8();
      upgrade = null;
    }
  };

  func getQueryParam(url : Text, param : Text) : ?Text {
    let needle = param # "=";
    let parts = url.split(#text needle).toArray();
    if (parts.size() < 2) return null;
    let after = parts[1];
    let valueParts = after.split(#text "&").toArray();
    if (valueParts.size() < 1) return null;
    ?valueParts[0]
  };

  // ── HTTP endpoint for cron trigger ────────────────────────────────────────
  // GET /trigger-upload — returns upgrade=true so update handler runs
  // POST /trigger-upload — handled by http_request_update
  public query func http_request(req : HttpRequest) : async HttpResponse {
    let path = req.url.split(#text "?").toArray()[0];
    if (path == "/trigger-upload") {
      if (req.method == "GET") {
        return {
          status_code = 200;
          headers = [("Content-Type", "application/json")];
          body = "{\"info\":\"Send a POST request to this URL with ?channelId=YOUR_CHANNEL_ID to trigger an upload.\"}".encodeUtf8();
          upgrade = null;
        };
      };
      // POST — upgrade to update call
      return {
        status_code = 200;
        headers = [];
        body = Blob.fromArray([]);
        upgrade = ?true;
      };
    };
    {
      status_code = 404;
      headers = [("Content-Type", "application/json")];
      body = "{\"error\":\"Not found\"}".encodeUtf8();
      upgrade = null;
    }
  };

  public func http_request_update(req : HttpRequest) : async HttpResponse {
    let path = req.url.split(#text "?").toArray()[0];
    if (path != "/trigger-upload") {
      return jsonErr(404, "Not found");
    };
    if (req.method != "POST") {
      return jsonErr(405, "Method not allowed. Use POST.");
    };

    let channelId = switch (getQueryParam(req.url, "channelId")) {
      case null { return jsonErr(400, "Missing channelId parameter") };
      case (?id) { id };
    };

    // Verify channel config exists
    switch (channelConfigs.get(channelId)) {
      case null { return jsonErr(404, "Channel not found. Save settings from the app first.") };
      case (?_) {};
    };

    // Store the pending trigger with current timestamp
    pendingTriggers.add(channelId, Time.now());

    jsonOk("{\"status\":\"ok\",\"message\":\"Trigger queued for channel " # channelId # "\",\"triggeredAt\":\"" # Time.now().toText() # "\"}")
  };

  // ── Per-channel config methods ────────────────────────────────────────────
  public shared func saveChannelConfig(channelId : Text, config : ChannelConfig) : async () {
    channelConfigs.add(channelId, config);
  };

  public query func getChannelConfig(channelId : Text) : async ?ChannelConfig {
    channelConfigs.get(channelId)
  };

  // ── Pending trigger methods ───────────────────────────────────────────────
  public query func getPendingTrigger(channelId : Text) : async ?Int {
    pendingTriggers.get(channelId)
  };

  public shared func clearPendingTrigger(channelId : Text) : async () {
    pendingTriggers.remove(channelId);
  };

  // ── Existing methods ──────────────────────────────────────────────────────
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.add(caller, profile);
  };

  public query func getOAuthConfig() : async ?OAuthConfig {
    oAuthConfig;
  };

  public shared func setOAuthConfig(config : OAuthConfig) : async () {
    oAuthConfig := ?config;
  };

  public query func getQueue() : async [QueueItem] {
    uploadQueue.toArray();
  };

  public shared func addToQueue(item : QueueItem) : async () {
    uploadQueue.add(item);
  };

  public shared func removeFromQueue(driveFileId : Text) : async () {
    let filtered = uploadQueue.filter(func(item) { item.driveFileId != driveFileId });
    uploadQueue.clear();
    uploadQueue.addAll(filtered.toArray().values());
  };

  public shared func clearQueue() : async () {
    uploadQueue.clear();
  };

  public shared func reorderQueue(newOrder : [QueueItem]) : async () {
    uploadQueue.clear();
    uploadQueue.addAll(newOrder.values());
  };

  public query func getUploadHistory() : async [UploadHistoryEntry] {
    let entries = history.values();
    entries.toArray().sort();
  };

  public shared func recordUpload(entry : UploadHistoryEntry) : async Nat {
    let id = nextHistoryId;
    let newEntry = { entry with id; uploadedAt = Time.now() };
    history.add(id, newEntry);
    nextHistoryId += 1;
    id;
  };

  public query func getSchedulerState() : async SchedulerState {
    schedulerState;
  };

  public shared func setSchedulerEnabled(isEnabled : Bool) : async () {
    schedulerState := { schedulerState with isEnabled };
  };

  public shared func incrementUploadsToday() : async () {
    schedulerState := {
      schedulerState with
      uploadsToday = schedulerState.uploadsToday + 1;
      lastUploadTime = Time.now();
    };
  };

  public shared func resetDailyCount(newDate : Text) : async () {
    schedulerState := { schedulerState with uploadsToday = 0; lastUploadDate = newDate };
  };
};
