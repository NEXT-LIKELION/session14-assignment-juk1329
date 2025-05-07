/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Timestamp } = require("firebase-admin/firestore");

admin.initializeApp();
const db = admin.firestore();
const userCollection = db.collection("users");
// ─────────────────────────────
// 유틸 함수
// ─────────────────────────────
function containsKorean(str) {
    return /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(str);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─────────────────────────────
// 1. 유저 가입
// ─────────────────────────────
exports.registerUser = onRequest(async (req, res) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).send("Name and email are required.");
    }

    if (containsKorean(name)) {
        return res.status(400).send("Name must not contain Korean characters.");
    }

    if (!isValidEmail(email)) {
        return res.status(400).send("Invalid email format.");
    }

    const createdAt = Timestamp.now();

    await userCollection.add({ name, email, createdAt });

    return res.status(201).send("User registered successfully.");
});

// ─────────────────────────────
// 2. 이름으로 유저 조회
// ─────────────────────────────
exports.getUserByName = onRequest(async (req, res) => {
    const { name } = req.query;

    if (!name) {
        return res.status(400).send("Name query parameter is required.");
    }

    const snapshot = await userCollection.where("name", "==", name).get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json(users);
});

// ─────────────────────────────
// 3. 이메일 수정 (유효성 검사 포함)
// ─────────────────────────────
exports.updateUserEmail = onRequest(async (req, res) => {
    const { id, newEmail } = req.body;

    if (!id || !newEmail) {
        return res.status(400).send("User ID and new email are required.");
    }

    if (!isValidEmail(newEmail)) {
        return res.status(400).send("Invalid email format.");
    }

    const userDoc = userCollection.doc(id);
    const doc = await userDoc.get();

    if (!doc.exists) {
        return res.status(404).send("User not found.");
    }

    await userDoc.update({ email: newEmail });

    return res.status(200).send("Email updated successfully.");
});

// ─────────────────────────────
// 4. 유저 삭제 (가입 후 1분 경과 시에만 가능)
// ─────────────────────────────
exports.deleteUser = onRequest(async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).send("User ID is required.");
    }

    const userDoc = userCollection.doc(id);
    const doc = await userDoc.get();

    if (!doc.exists) {
        return res.status(404).send("User not found.");
    }

    const { createdAt } = doc.data();

    const now = Timestamp.now();
    const elapsedSeconds = now.seconds - createdAt.seconds;

    if (elapsedSeconds < 60) {
        return res
            .status(403)
            .send("Cannot delete user within 1 minute of registration.");
    }

    await userDoc.delete();

    return res.status(200).send("User deleted successfully.");
});
