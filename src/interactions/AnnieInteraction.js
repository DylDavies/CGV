// src/interactions/AnnieInteraction.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127.0/build/three.module.js';
import { StageManager } from '../systems/StageManager';

/**
 * Represents a single node in a dialogue tree.
 * Each node contains dialogue content and edges to other nodes.
 */
class DialogueNode {
    /**
     * @param {string} id - Unique identifier for this node
     * @param {string} speaker - Name of the speaker
     * @param {string} text - The dialogue text content
     * @param {object} options - Optional configuration
     */
    constructor(id, speaker, text, options = {}) {
        this.id = id;
        this.speaker = speaker;
        this.text = text;
        this.edges = []; // Array of DialogueEdge objects
        this.onEnter = options.onEnter || null; // Callback when entering this node
        this.onExit = options.onExit || null; // Callback when leaving this node
        this.metadata = options.metadata || {}; // Additional data
    }

    /**
     * Adds an edge (choice) to another node
     * @param {DialogueEdge} edge - The edge to add
     */
    addEdge(edge) {
        this.edges.push(edge);
    }

    /**
     * Checks if this is a leaf node (no outgoing edges)
     */
    isLeaf() {
        return this.edges.length === 0;
    }
}

/**
 * Represents an edge (choice) between dialogue nodes.
 * Contains the text shown to the player and the target node.
 */
class DialogueEdge {
    /**
     * @param {string} choiceText - Text displayed for this choice
     * @param {string} targetNodeId - ID of the node this edge leads to
     * @param {object} options - Optional configuration
     */
    constructor(choiceText, targetNodeId, options = {}) {
        this.choiceText = choiceText;
        this.targetNodeId = targetNodeId;
        this.condition = options.condition || null; // Function that returns true if this choice is available
        this.onSelect = options.onSelect || null; // Callback when this choice is selected
        this.metadata = options.metadata || {};
    }

    /**
     * Checks if this edge is available (condition passes)
     */
    isAvailable() {
        return !this.condition || this.condition();
    }
}

/**
 * Manages a dialogue tree structure with nodes and edges.
 * Handles navigation, rendering, and interaction with the dialogue system.
 */
class DialogueTree {
    constructor() {
        this.nodes = new Map(); // Map of nodeId -> DialogueNode
        this.currentNode = null;
        this.rootNodeId = null;
    }

    /**
     * Adds a node to the tree
     * @param {DialogueNode} node - The node to add
     * @param {boolean} isRoot - Whether this is the root node
     */
    addNode(node, isRoot = false) {
        this.nodes.set(node.id, node);
        if (isRoot) {
            this.rootNodeId = node.id;
        }
    }

    /**
     * Gets a node by ID
     * @param {string} nodeId - The node ID
     * @returns {DialogueNode|null}
     */
    getNode(nodeId) {
        return this.nodes.get(nodeId) || null;
    }

    /**
     * Starts the dialogue tree from the root
     */
    start() {
        if (!this.rootNodeId) {
            console.error('DialogueTree: No root node set');
            return;
        }
        this.navigateToNode(this.rootNodeId);
    }

    /**
     * Navigates to a specific node
     * @param {string} nodeId - The node ID to navigate to
     */
    navigateToNode(nodeId) {
        const node = this.getNode(nodeId);
        if (!node) {
            console.error(`DialogueTree: Node ${nodeId} not found`);
            return;
        }

        // Call onExit for previous node
        if (this.currentNode && this.currentNode.onExit) {
            this.currentNode.onExit();
        }

        // Set new current node
        this.currentNode = node;

        // Call onEnter for new node
        if (node.onEnter) {
            node.onEnter();
        }
    }

    /**
     * Gets the current node
     * @returns {DialogueNode|null}
     */
    getCurrentNode() {
        return this.currentNode;
    }

    /**
     * Clears the dialogue tree
     */
    clear() {
        this.nodes.clear();
        this.currentNode = null;
        this.rootNodeId = null;
    }
}

class AnnieInteraction {
    /**
     * @param {InteractionSystem} interactionSystem - A reference to the main interaction system.
     * @param {StageManager} stageManager
     */
    constructor(interactionSystem, stageManager) {
        this.interactionSystem = interactionSystem;

        // --- Get direct references to core systems ---
        console.log("interactionSystem", interactionSystem);
        this.gameManager = interactionSystem.gameManager;
        this.camera = interactionSystem.camera;
        this.controls = interactionSystem.controls;
        this.audioManager = interactionSystem.audioManager;
        this.stageManager = stageManager;

        // Dialogue tree for Annie
        this.dialogueTree = null;

        // Track which endings have been reached (allows re-exploring different branches)
        this.completedEndings = new Set();

        // Track which dialogue choices have been selected (to hide them on subsequent interactions)
        this.selectedChoices = new Set();

        // Current playing audio ID for dialogue
        this.currentDialogueAudio = null;
    }

    // --- Public Methods (called by InteractionSystem) ---

    /**
     * Checks if the hovered object data is for the Annie doll.
     * This is used by updateCrosshair to prevent showing a prompt for her.
     * @param {object} interactableData - The userData of the object.
     * @returns {boolean}
     */
    isAnnieBlock(interactableData) {
        return interactableData && interactableData.data.type === 'annie';
    }

    /**
     * Maps node IDs to their audio file paths
     * Adjust these paths based on where your m4a files are located
     */
    getAudioPathForNode(nodeId) {
        const audioBasePath = '/public/audio/annie/';
        const audioMap = {
            'START': `${audioBasePath}START.m4a`,
            '1.0_FREE': `${audioBasePath}1.0_FREE.m4a`,
            '1.1_POTION_WIN': `${audioBasePath}1.1_POTION_WIN.m4a`,
            '1.2_POTION_LOSE': `${audioBasePath}1.2_POTION_LOSE.m4a`,
            '2.0_PAGE': `${audioBasePath}2.0_PAGE.m4a`,
            '2.1_PAGE_WIN': `${audioBasePath}2.1_PAGE_WIN.m4a`,
            '2.1.1_SHADOW_RIDDLE': `${audioBasePath}2.1.1_SHADOW_RIDDLE.m4a`,
            '2.1.1.1_CHEAT': `${audioBasePath}2.1.1.1_CHEAT.m4a`,
            '2.1.1.2_CALL_OUT': `${audioBasePath}2.1.1.2_CALL_OUT.m4a`,
            '2.1.1.3_SUPER_ENDING': `${audioBasePath}2.1.1.3_SUPER_ENDING.m4a`,
            '2.1.2_PAGE_ONLY': `${audioBasePath}2.1.2_PAGE_ONLY.m4a`,
            '2.2_PAGE_RETRY': `${audioBasePath}2.2_PAGE_RETRY.m4a`,
            '2.2.1_REFUSAL': `${audioBasePath}2.2.1_REFUSAL.m4a`,
            '3.0_WHO': `${audioBasePath}3.0_WHO.m4a`,
            '3.1_REFUSAL': `${audioBasePath}3.1_REFUSAL.m4a`,
            '3.2_NICE': `${audioBasePath}3.2_NICE.m4a`,
            '3.2.1_FRIEND_ENDING': `${audioBasePath}3.2.1_FRIEND_ENDING.m4a`,
            '3.3_DIRECT': `${audioBasePath}3.3_DIRECT.m4a`
        };
        return audioMap[nodeId] || null;
    }

    /**
     * Plays audio for a dialogue node
     */
    playDialogueAudio(nodeId) {
        // Stop current audio if playing
        this.stopDialogueAudio();

        const audioPath = this.getAudioPathForNode(nodeId);
        console.log("Audio Path: ", audioPath);
        if (audioPath && this.audioManager) {
            const audioId = `annie_dialogue_${nodeId}`;
            console.log(`🔊 Playing Annie dialogue audio: ${audioId} from ${audioPath}`);
            this.audioManager.playSound(audioId, audioPath, false, 0.7);
            this.currentDialogueAudio = audioId;
        }
    }

    /**
     * Stops currently playing dialogue audio
     */
    stopDialogueAudio() {
        if (this.currentDialogueAudio && this.audioManager) {
            console.log(`🔇 Stopping Annie dialogue audio: ${this.currentDialogueAudio}`);
            this.audioManager.stopSound(this.currentDialogueAudio, 200); // 200ms fade out
            this.currentDialogueAudio = null;
        }
    }

    /**
     * Builds the dialogue tree for Annie's page interaction from JSON dialogue data
     * @param {THREE.Object3D} pageObject - The page object
     * @param {object} userData - The page's userData
     * @returns {DialogueTree}
     */
    buildAnnieDialogueTree(pageObject, userData) {
        const tree = new DialogueTree();

        // Annie's dialogue data
        const dialogueData = {
            "START": {
                "speaker": "Annie",
                "text": "Hehe... trying to steal, are we? That's not very nice. That's *my* paper. \n... so tell me, why are you here?",
                "options": [
                    { "text": "I want to be free.", "next": "1.0_FREE" },
                    { "text": "I want that page.", "next": "2.0_PAGE" },
                    { "text": "What... *who* are you?", "next": "3.0_WHO" }
                ]
            },
            "1.0_FREE": {
                "speaker": "Annie",
                "text": "Free? Everyone wants to be free... I have a riddle for you. Answer it right, and you can be free, too!\n\n*'The person who makes it, sells it. The person who buys it, never uses it. The person who uses it, never knows they're using it. What is it?'*",
                "options": [
                    { "text": "A coffin.", "next": "1.1_POTION_WIN" },
                    { "text": "Poison.", "next": "1.2_POTION_LOSE" },
                    { "text": "A grave.", "next": "1.2_POTION_LOSE" },
                    { "text": "A ticket.", "next": "1.2_POTION_LOSE" }
                ]
            },
            "1.1_POTION_WIN": {
                "speaker": "Annie",
                "text": "Hehe, clever! You're right! Here's your freedom.",
                "ending": "ENDING_1_POTION"
            },
            "1.2_POTION_LOSE": {
                "speaker": "Annie",
                "text": "Wrong! Are you trying? Here, this will make you 'free' anyway. Hehe.",
                "ending": "ENDING_1_POTION"
            },
            "2.0_PAGE": {
                "speaker": "Annie",
                "text": "The page? But it's *my* page. Hmm... I'll play you for it! Answer my riddle. Win, and it's yours. Lose, and... well, you just lose! Hehe.\n\n*'What is always in front of you but can't be seen?'*",
                "options": [
                    { "text": "The future.", "next": "2.1_PAGE_WIN" },
                    { "text": "The air.", "next": "2.2_PAGE_RETRY" },
                    { "text": "My nose.", "next": "2.2_PAGE_RETRY" },
                    { "text": "This is stupid.", "next": "2.2_PAGE_RETRY" }
                ]
            },
            "2.1_PAGE_WIN": {
                "speaker": "Annie",
                "text": "You're right! You win! How boring... Oh, well. A promise is a promise. \n...Do you want to play *another* game? A fun one?",
                "options": [
                    { "text": "Yes! I'd love to play with you.", "next": "2.1.1_SHADOW_RIDDLE" },
                    { "text": "No, just give me the page like you promised.", "next": "2.1.2_PAGE_ONLY" }
                ]
            },
            "2.1.1_SHADOW_RIDDLE": {
                "speaker": "Annie",
                "text": "Yay! Okay, okay, riddle me this... \n\n*'I follow you all day long, but disappear when the sun goes down or it rains. What am I?'*",
                "options": [
                    { "text": "A shadow.", "next": "2.1.1.1_CHEAT" },
                    { "text": "Your reflection.", "next": "2.1.1.1_CHEAT" },
                    { "text": "Your footprint.", "next": "2.1.1.1_CHEAT" }
                ]
            },
            "2.1.1.1_CHEAT": {
                "speaker": "Annie",
                "text": "No, silly! The answer was... 'my friend'! Because *I* would disappear if it rains! Hehe, I win! That was fun, right?",
                "options": [
                    { "text": "That's not fair! You cheated!", "next": "2.1.1.2_CALL_OUT" },
                    { "text": "Hehe, you got me! That was a good one.", "next": "2.1.1.3_SUPER_ENDING" },
                    { "text": "I... guess? Just give me the page.", "next": "2.1.2_PAGE_ONLY" }
                ]
            },
            "2.1.1.2_CALL_OUT": {
                "speaker": "Annie",
                "text": "Hmph! You're no fun at all! Just like the others. Fine! Take your stupid page and *go*!",
                "ending": "ENDING_2_PAGE_ONLY"
            },
            "2.1.1.3_SUPER_ENDING": {
                "speaker": "Annie",
                "text": "You... you're not mad? You still want to play? Oh, *goodie!* You're my new best friend! Here's the silly page... but you *have* to take me with you! We'll play forever!",
                "ending": "ENDING_3_TAKE_ANNIE"
            },
            "2.1.2_PAGE_ONLY": {
                "speaker": "Annie",
                "text": "Hmph. Fine. Sooo boring. Here's your stupid page. Now go away.",
                "ending": "ENDING_2_PAGE_ONLY"
            },
            "2.2_PAGE_RETRY": {
                "speaker": "Annie",
                "text": "Wrong! Wrong! *So* wrong! Hehe. Do you want to try again?",
                "options": [
                    { "text": "I'll try again.", "next": "2.0_PAGE" },
                    { "text": "No, this is pointless.", "next": "2.2.1_REFUSAL" }
                ]
            },
            "2.2.1_REFUSAL": {
                "speaker": "Annie",
                "text": "Then you get NOTHING! Go away!",
                "ending": "ENDING_4_REFUSAL"
            },
            "3.0_WHO": {
                "speaker": "Annie",
                "text": "I'm *Annie*, silly! I've been here forever... and ever... and *ever*. It's so boring.",
                "options": [
                    { "text": "You're just a creepy doll. Give me the page.", "next": "3.1_REFUSAL" },
                    { "text": "That sounds lonely. I'm sorry, Annie.", "next": "3.2_NICE" },
                    { "text": "I see. Well, I need that page to leave.", "next": "3.3_DIRECT" }
                ]
            },
            "3.1_REFUSAL": {
                "speaker": "Annie",
                "text": "Creepy?! You're the one who's creepy! And *mean*! I'm not giving you anything! Go away!",
                "ending": "ENDING_4_REFUSAL"
            },
            "3.2_NICE": {
                "speaker": "Annie",
                "text": "Lonely? Yes... it is. Will you be my friend?",
                "options": [
                    { "text": "Yes, I'll be your friend.", "next": "3.2.1_FRIEND_ENDING" },
                    { "text": "I can't. I just need to get free.", "next": "1.0_FREE" }
                ]
            },
            "3.2.1_FRIEND_ENDING": {
                "speaker": "Annie",
                "text": "A friend? You... you *promise*? Oh, *goodie!* You're my new best friend! Here's the silly page... but you *have* to take me with you! We'll play forever!",
                "ending": "ENDING_3_TAKE_ANNIE"
            },
            "3.3_DIRECT": {
                "speaker": "Annie",
                "text": "Leave? Oh... *everyone* wants to leave. Do you want the page? Or do you want to be *free*?",
                "options": [
                    { "text": "I want the page.", "next": "2.0_PAGE" },
                    { "text": "I want to be free.", "next": "1.0_FREE" }
                ]
            }
        };

        // Build dialogue tree from JSON data
        for (const [nodeId, nodeData] of Object.entries(dialogueData)) {
            const options = {};

            // Add audio playback on node enter
            options.onEnter = () => {
                this.playDialogueAudio(nodeId);
            };

            // Handle endings and audio stop
            if (nodeData.ending) {
                const originalOnExit = () => {
                    this.handleEnding(nodeData.ending, pageObject, userData);
                };
                options.onExit = () => {
                    this.stopDialogueAudio();
                    originalOnExit();
                };
            } else {
                // Stop audio when leaving non-ending nodes
                options.onExit = () => {
                    this.stopDialogueAudio();
                };
            }

            const node = new DialogueNode(nodeId, nodeData.speaker, nodeData.text, options);
            tree.addNode(node, nodeId === "START");

            // Add edges (options)
            if (nodeData.options) {
                for (const option of nodeData.options) {
                    node.addEdge(new DialogueEdge(option.text, option.next));
                }
            }
        }

        return tree;
    }

    /**
     * Handles the different endings for Annie's dialogue
     * @param {string} endingType - The type of ending
     * @param {THREE.Object3D} pageObject - The page object
     * @param {object} userData - The page's userData
     */
    handleEnding(endingType, pageObject, userData) {
        console.log(`🎎 Annie ending: ${endingType}`);
        this.stopLookingAtAnnie();

        // Check if this ending has already been reached
        if (this.completedEndings.has(endingType)) {
            console.log(`🎎 Ending ${endingType} already seen - showing message`);
            this.interactionSystem.showMessage("Annie giggles... 'We already played that game. Try something different!'");
            return;
        }

        // Mark this ending as completed
        this.completedEndings.add(endingType);
        console.log(`🎎 Completed endings: ${Array.from(this.completedEndings).join(', ')}`);

        switch (endingType) {
            case "ENDING_1_POTION":
                // Give player a potion (freedom potion)
                this.gameManager.addToInventory({
                    name: 'Freedom Potion',
                    type: 'potion',
                    description: 'A mysterious potion given by Annie. What does freedom taste like?',
                    effect: 'annie_death', // Special effect to trigger death
                    pageId: userData.pageId // Store page ID for death handling
                });
                this.interactionSystem.showMessage("Annie gives you a strange potion...");
                break;

            case "ENDING_2_PAGE_ONLY":
                // Just give the page
                this.gameManager.collectPage(userData.pageId);
                this.interactionSystem.animateItemPickup(pageObject, () => {
                    if (pageObject.parent) {
                        pageObject.parent.remove(pageObject);
                    }
                    setTimeout(() => {
                        this.interactionSystem.showPageContent(userData.pageId);
                    }, 200);
                });
                break;

            case "ENDING_3_TAKE_ANNIE":
                // Give page AND take Annie with you
                this.gameManager.collectPage(userData.pageId);
                this.gameManager.addToInventory({
                    name: 'Annie (Doll)',
                    type: 'companion',
                    description: 'Your new best friend. She giggles softly from your bag.'
                });

                // Make Annie doll disappear from the scene
                const annieDoll = this.stageManager.currentLoader.props.get('annie');
                if (annieDoll) {
                    annieDoll.visible = false;
                    console.log('🎎 Annie doll removed from scene - she joined you!');
                }

                this.interactionSystem.animateItemPickup(pageObject, () => {
                    if (pageObject.parent) {
                        pageObject.parent.remove(pageObject);
                    }
                    setTimeout(() => {
                        this.interactionSystem.showPageContent(userData.pageId);
                    }, 200);
                });
                this.interactionSystem.showMessage("Annie is now your companion!");
                break;

            case "ENDING_4_REFUSAL":
                // Player refuses - Annie kills them
                console.log('💀 Annie refusal - player will die');
                this.interactionSystem.showMessage("Annie's face twists into a horrible grimace...");

                // Trigger death after a short delay
                setTimeout(async () => {
                    console.log('💀 Calling onPlayerDeath("annie_refusal")');
                    await this.gameManager.onPlayerDeath('annie_refusal');
                }, 2000);
                break;

            default:
                console.warn(`Unknown ending type: ${endingType}`);
                break;
        }
    }

    /**
     * OLD METHOD - Replaced by new JSON-based dialogue tree
     * @deprecated
     */
    buildAnnieDialogueTree_OLD(pageObject, userData) {
        const tree = new DialogueTree();

        // Root node - Annie asks if player wants the paper
        const rootNode = new DialogueNode('root', 'Annie', 'Do you want the paper?');
        tree.addNode(rootNode, true);

        // Branch 1: Player says "Yes" initially
        const yesConfirmNode = new DialogueNode('yes_confirm', 'Annie', 'Are you sure? This paper... it\'s special. Once you take it, there\'s no going back.');
        tree.addNode(yesConfirmNode);

        // Branch 1a: Player confirms they want it
        const acceptNode = new DialogueNode('accept', 'Annie', 'Here you go... Be careful with it.', {
            onExit: () => {
                console.log('🎎 Annie: Giving page to player');
                this.stopLookingAtAnnie();
                this.gameManager.collectPage(userData.pageId);
                this.interactionSystem.animateItemPickup(pageObject, () => {
                    if (pageObject.parent) {
                        pageObject.parent.remove(pageObject);
                    }
                    // Show page content after collecting from Annie
                    setTimeout(() => {
                        this.interactionSystem.showPageContent(userData.pageId);
                    }, 200);
                });
            }
        });
        tree.addNode(acceptNode);

        // Branch 1b: Player changes mind
        const changesMindNode = new DialogueNode('changes_mind', 'Annie', 'Wise choice... or maybe not. You\'ll come back for it. They always do.', {
            onExit: () => {
                console.log('🎎 Annie: Player changed mind');
                this.stopLookingAtAnnie();
                this.interactionSystem.showMessage("You decide not to take the paper... for now.");
            }
        });
        tree.addNode(changesMindNode);

        // Branch 2: Player says "No" initially
        const noResponseNode = new DialogueNode('no_response', 'Annie', 'But you need it... don\'t you? I can see it in your eyes.');
        tree.addNode(noResponseNode);

        // Branch 2a: Player reconsiders and takes it
        const reconsiderNode = new DialogueNode('reconsider', 'Annie', 'I thought so... They always take it in the end.', {
            onEnter: () => {
                console.log('🎎 Annie: Player reconsidered');
            }
        });
        tree.addNode(reconsiderNode);

        // This leads to the same accept node (reusing the node)
        const reconsiderAcceptNode = new DialogueNode('reconsider_accept', 'Annie', 'Here you go... though I wonder if you truly understand what you\'re taking.', {
            onExit: () => {
                console.log('🎎 Annie: Giving page to player (after reconsideration)');
                this.stopLookingAtAnnie();
                this.gameManager.collectPage(userData.pageId);
                this.interactionSystem.animateItemPickup(pageObject, () => {
                    if (pageObject.parent) {
                        pageObject.parent.remove(pageObject);
                    }
                    setTimeout(() => {
                        this.interactionSystem.showPageContent(userData.pageId);
                    }, 200);
                });
            }
        });
        tree.addNode(reconsiderAcceptNode);

        // Branch 2b: Player refuses again
        const finalDeclineNode = new DialogueNode('final_decline', 'Annie', 'Okay... but the paper will still be here. Waiting. Like me.', {
            onExit: () => {
                console.log('🎎 Annie: Player firmly declined');
                this.stopLookingAtAnnie();
                this.interactionSystem.showMessage("You firmly decide not to take the paper.");
            }
        });
        tree.addNode(finalDeclineNode);

        // Branch 3: Player asks about Annie
        const whoAreYouNode = new DialogueNode('who_are_you', 'Annie', 'I\'m Annie. I\'ve been here a very long time... longer than you can imagine. This mansion keeps me company.');
        tree.addNode(whoAreYouNode);

        // After learning about Annie, return to the question
        const afterIntroNode = new DialogueNode('after_intro', 'Annie', 'Now... about that paper. Do you want it?');
        tree.addNode(afterIntroNode);

        // Build the edges (connections between nodes)
        // From root
        rootNode.addEdge(new DialogueEdge('Yes', 'yes_confirm'));
        rootNode.addEdge(new DialogueEdge('No', 'no_response'));
        rootNode.addEdge(new DialogueEdge('Who are you?', 'who_are_you'));

        // From yes_confirm
        yesConfirmNode.addEdge(new DialogueEdge('I\'m sure', 'accept'));
        yesConfirmNode.addEdge(new DialogueEdge('Maybe not...', 'changes_mind'));

        // From no_response
        noResponseNode.addEdge(new DialogueEdge('Actually, yes, I do need it', 'reconsider'));
        noResponseNode.addEdge(new DialogueEdge('No, I really don\'t', 'final_decline'));

        // From reconsider (player reconsidered)
        reconsiderNode.addEdge(new DialogueEdge('Give me the paper', 'reconsider_accept'));
        reconsiderNode.addEdge(new DialogueEdge('Wait, no. I don\'t want it', 'final_decline'));

        // From who_are_you (loop back to question)
        whoAreYouNode.addEdge(new DialogueEdge('Tell me more', 'after_intro'));

        // From after_intro (loops back to the choice)
        afterIntroNode.addEdge(new DialogueEdge('Yes, I want it', 'yes_confirm'));
        afterIntroNode.addEdge(new DialogueEdge('No, thank you', 'final_decline'));

        return tree;
    }

    /**
     * Handles the specific interaction for Page 4, which triggers the dialogue.
     * @param {THREE.Object3D} pageObject - The S_Page4 object.
     * @param {object} userData - The S_Page4 userData.
     */
    handleAnniePageInteraction(pageObject, userData) {
        // Check if all endings have been explored (4 total endings)
        if (this.completedEndings.size >= 4) {
            console.log('🎎 All Annie endings explored - blocking re-entry');
            this.interactionSystem.showMessage("You've already explored everything Annie has to offer.");
            return;
        }

        // Clear all prompts immediately
        this.clearPrompts();

        // Set interaction state immediately to prevent prompts from showing
        this.interactionSystem.currentInteraction = 'annie_interaction';
        console.log('🎎 Starting Annie interaction - prompts cleared');

        // Get Annie doll from mansion
        const annie = this.stageManager.currentLoader.props.get('annie');

        if (!annie) {
            console.warn('Annie doll not found! Allowing normal page pickup.');
            // Fall back to normal page collection
            this.interactionSystem.currentInteraction = null;
            this.gameManager.collectPage(userData.pageId);
            this.interactionSystem.animateItemPickup(pageObject, () => {
                if (pageObject.parent) {
                    pageObject.parent.remove(pageObject);
                }
            });
            return;
        }

        // Make camera look at Annie and wait for animation to complete before showing dialogue
        this.lookAtAnnie(annie, () => {
            // Build and start the dialogue tree after camera focuses
            this.dialogueTree = this.buildAnnieDialogueTree(pageObject, userData);
            this.dialogueTree.start();

            // Show the first dialogue node
            this.showDialogue();
        });
    }


    // --- Private Helper Methods ---

    /**
     * Clears all interaction prompts from the screen
     */
    clearPrompts() {
        const currentPrompt = this.interactionSystem.interactionPrompt.textContent;
        if (currentPrompt) {
            console.log(`🎎 Clearing prompt before Annie dialogue: "${currentPrompt}"`);
        }
        this.interactionSystem.interactionPrompt.style.display = 'none';
        this.interactionSystem.interactionPrompt.textContent = '';
        this.interactionSystem.crosshair.style.background = 'white';
        this.interactionSystem.crosshair.style.borderColor = 'rgba(255,255,255,0.8)';
        this.interactionSystem.crosshair.style.width = '4px';
        this.interactionSystem.crosshair.style.height = '4px';
    }

    /**
     * Renders the current dialogue node from the dialogue tree
     */
    showDialogue() {
        if (!this.dialogueTree) {
            console.error('AnnieInteraction: No dialogue tree available');
            return;
        }

        const node = this.dialogueTree.getCurrentNode();
        if (!node) {
            console.error('AnnieInteraction: No current node in dialogue tree');
            return;
        }

        // Clear prompts and freeze controls
        this.clearPrompts();
        if (this.controls) this.controls.freeze();
        this.interactionSystem.currentInteraction = 'dialogue';

        // Blur any active element (like canvas) to prepare for dialogue focus
        if (document.activeElement) {
            document.activeElement.blur();
        }

        // Create fullscreen overlay to prevent clicks outside
        const dialogueOverlay = document.createElement('div');
        dialogueOverlay.id = 'dialogue-overlay';
        dialogueOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            z-index: 9998;
            display: flex;
            align-items: flex-end;
            justify-content: center;
        `;

        // Prevent clicks from passing through
        dialogueOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('💬 Dialogue overlay blocked click - cannot close dialogue by clicking outside');
        });

        // Create dialogue container at bottom of screen
        const dialogueBox = document.createElement('div');
        dialogueBox.id = 'dialogue-box';
        dialogueBox.tabIndex = 0;
        dialogueBox.style.cssText = `
            position: fixed;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 800px;
            background: linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(40, 40, 40, 0.95));
            border: 2px solid #8b4513;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
            z-index: 9999;
        `;

        // Speaker name
        const speakerName = document.createElement('div');
        speakerName.textContent = node.speaker || 'Unknown';
        speakerName.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #d4af37;
            margin-bottom: 10px;
        `;

        // Dialogue text
        const dialogueText = document.createElement('div');
        dialogueText.textContent = node.text;
        dialogueText.style.cssText = `
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
            color: #e0e0e0;
        `;

        // Options container
        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

        dialogueBox.appendChild(speakerName);
        dialogueBox.appendChild(dialogueText);
        dialogueBox.appendChild(optionsContainer);

        // Check if this node requires text input instead of buttons
        const isTextInputNode = (node.id === '1.0_FREE' || node.id === '2.0_PAGE');

        // If this is a text input node, show text input instead of buttons
        if (isTextInputNode) {
            // Create text input field
            const inputField = document.createElement('input');
            inputField.type = 'text';
            inputField.placeholder = 'Type your answer here...';
            inputField.style.cssText = `
                width: 100%;
                padding: 12px;
                font-size: 16px;
                background: rgba(20, 20, 20, 0.8);
                color: #e0e0e0;
                border: 2px solid #8b4513;
                border-radius: 5px;
                margin-bottom: 10px;
                font-family: 'Courier New', monospace;
            `;

            // Create submit button
            const submitButton = document.createElement('button');
            submitButton.textContent = 'Submit Answer';
            submitButton.style.cssText = `
                width: 100%;
                padding: 12px 20px;
                font-size: 14px;
                background: rgba(139, 69, 19, 0.5);
                color: #e0e0e0;
                border: 1px solid #8b4513;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.2s;
            `;
            submitButton.onmouseover = () => {
                submitButton.style.background = 'rgba(139, 69, 19, 0.7)';
                submitButton.style.borderColor = '#d4af37';
            };
            submitButton.onmouseout = () => {
                submitButton.style.background = 'rgba(139, 69, 19, 0.5)';
                submitButton.style.borderColor = '#8b4513';
            };

            // Handle text input submission
            const handleSubmit = () => {
                const userInput = inputField.value.trim().toLowerCase();
                let targetNodeId = null;

                // Determine which node to go to based on input
                if (node.id === '1.0_FREE') {
                    // Check if input contains "coffin"
                    if (userInput.includes('coffin')) {
                        targetNodeId = '1.1_POTION_WIN';
                    } else {
                        targetNodeId = '1.2_POTION_LOSE';
                    }
                } else if (node.id === '2.0_PAGE') {
                    // Check if input contains "future"
                    if (userInput.includes('future')) {
                        targetNodeId = '2.1_PAGE_WIN';
                    } else {
                        targetNodeId = '2.2_PAGE_RETRY';
                    }
                }

                if (targetNodeId) {
                    // Remove dialogue UI
                    this.removeDialogueUI();

                    // Navigate to the next node
                    const targetNode = this.dialogueTree.getNode(targetNodeId);
                    if (targetNode) {
                        this.dialogueTree.navigateToNode(targetNodeId);

                        // Show the next dialogue node
                        setTimeout(() => {
                            this.showDialogue();
                        }, 100);
                    } else {
                        // No target node, end dialogue
                        this.endDialogue();
                    }
                }
            };

            // Submit on button click
            submitButton.onclick = handleSubmit;

            // Submit on Enter key
            inputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                }
            });

            // Stop propagation of keyboard events from input field (bubble phase)
            // This prevents game controls from receiving the events after the input handles them
            inputField.addEventListener('keydown', (e) => {
                e.stopPropagation();
            }, false);
            inputField.addEventListener('keyup', (e) => {
                e.stopPropagation();
            }, false);
            inputField.addEventListener('keypress', (e) => {
                e.stopPropagation();
            }, false);

            optionsContainer.appendChild(inputField);
            optionsContainer.appendChild(submitButton);

            // Focus the input field immediately
            setTimeout(() => {
                inputField.focus();
            }, 100);
        }
        // If there are edges (choices), show them as buttons
        else if (node.edges && node.edges.length > 0) {
            // Filter out already selected choices and check availability
            const availableEdges = node.edges.filter(edge => {
                const choiceKey = `${node.id}:${edge.choiceText}`;
                return edge.isAvailable() && !this.selectedChoices.has(choiceKey);
            });

            availableEdges.forEach((edge, index) => {
                const button = document.createElement('button');
                button.textContent = `${index + 1}. ${edge.choiceText}`;
                button.style.cssText = `
                    padding: 12px 20px;
                    font-size: 14px;
                    background: rgba(139, 69, 19, 0.3);
                    color: #e0e0e0;
                    border: 1px solid #8b4513;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: all 0.2s;
                `;
                button.onmouseover = () => {
                    button.style.background = 'rgba(139, 69, 19, 0.5)';
                    button.style.borderColor = '#d4af37';
                };
                button.onmouseout = () => {
                    button.style.background = 'rgba(139, 69, 19, 0.3)';
                    button.style.borderColor = '#8b4513';
                };
                button.onclick = () => {
                    // Track this choice as selected
                    const choiceKey = `${node.id}:${edge.choiceText}`;
                    this.selectedChoices.add(choiceKey);
                    console.log(`💬 Choice selected and tracked: ${choiceKey}`);

                    // Call onSelect callback if present
                    if (edge.onSelect) {
                        edge.onSelect();
                    }

                    // Remove dialogue UI
                    this.removeDialogueUI();

                    // Navigate to the next node
                    const targetNode = this.dialogueTree.getNode(edge.targetNodeId);
                    if (targetNode) {
                        this.dialogueTree.navigateToNode(edge.targetNodeId);

                        // If target node has edges, show it; otherwise end dialogue
                        if (!targetNode.isLeaf()) {
                            setTimeout(() => {
                                this.showDialogue();
                            }, 100);
                        } else {
                            // Leaf node - show it with a continue button
                            setTimeout(() => {
                                this.showDialogue();
                            }, 100);
                        }
                    } else {
                        // No target node, end dialogue
                        this.endDialogue();
                    }
                };
                optionsContainer.appendChild(button);
            });
        } else {
            // Leaf node - show a "Continue" button
            const continueButton = document.createElement('button');
            continueButton.textContent = 'Continue';
            continueButton.style.cssText = `
                padding: 12px 20px;
                background: rgba(139, 69, 19, 0.3);
                color: #e0e0e0;
                border: 1px solid #8b4513;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            `;
            continueButton.onclick = () => {
                // Call onExit for leaf node before ending dialogue
                if (node.onExit) {
                    console.log(`💬 Calling onExit for node: ${node.id}`);
                    node.onExit();
                }
                this.removeDialogueUI();
                this.endDialogue();
            };
            optionsContainer.appendChild(continueButton);
        }

        // CRITICAL: Add document-level capture listener to intercept ALL keyboard events
        // This MUST run BEFORE PlayerControls to prevent game input during dialogue
        const dialogueKeyHandler = (e) => {
            // ALLOW keyboard input if focused on a text input field
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                // Let the event reach the input field - the input's own handlers will stop propagation
                return;
            }

            // For all other events, completely block them
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            return false;
        };

        // Register on document with capture=true at the HIGHEST priority
        document.addEventListener('keydown', dialogueKeyHandler, true);
        document.addEventListener('keyup', dialogueKeyHandler, true);

        // Store reference to remove later
        dialogueBox.dialogueKeyHandler = dialogueKeyHandler;

        // Append overlay first, then dialogue box on top
        document.body.appendChild(dialogueOverlay);
        dialogueOverlay.appendChild(dialogueBox);

        // Simple focus - keyboard events are already blocked at document level
        // so focus is less critical now
        dialogueBox.focus();
        setTimeout(() => {
            dialogueBox.focus();
            console.log('💬 Dialogue displayed - keyboard input blocked at document level');
        }, 50);
    }

    /**
     * Removes the dialogue UI from the screen
     */
    removeDialogueUI() {
        const dialogueBox = document.getElementById('dialogue-box');

        // CRITICAL: Remove document-level key handlers FIRST to restore game controls
        if (dialogueBox && dialogueBox.dialogueKeyHandler) {
            document.removeEventListener('keydown', dialogueBox.dialogueKeyHandler, true);
            document.removeEventListener('keyup', dialogueBox.dialogueKeyHandler, true);
            console.log('💬 Dialogue closed - game controls restored');
        }

        // Remove UI elements
        const overlay = document.getElementById('dialogue-overlay');
        if (overlay && document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
        if (dialogueBox && document.body.contains(dialogueBox)) {
            document.body.removeChild(dialogueBox);
        }
    }

    /**
     * Ends the dialogue and cleans up
     */
    endDialogue() {
        // Stop any playing audio
        this.stopDialogueAudio();

        this.interactionSystem.currentInteraction = null;
        if (this.controls) this.controls.unfreeze();

        // Clear the dialogue tree
        if (this.dialogueTree) {
            this.dialogueTree.clear();
            this.dialogueTree = null;
        }
    }

    /**
     * Freezes controls and animates the camera to look at the Annie doll.
     * @param {THREE.Object3D} annie - The Annie doll object.
     * @param {Function} onComplete - Callback to run when camera animation completes
     */
    lookAtAnnie(annie, onComplete = null) {
        // Store original camera state on the main interaction system
        this.interactionSystem.originalCameraLookAt = {
            enabled: true,
            target: annie
        };

        // Get Annie's world position
        const anniePosition = new THREE.Vector3();
        annie.getWorldPosition(anniePosition);

        // Look higher - add offset to Y coordinate (looking at Annie's face/upper body)
        anniePosition.y += 0.5; // Adjust this value to look higher or lower

        // Smoothly rotate camera to look at Annie
        const startQuaternion = this.camera.quaternion.clone();
        this.camera.lookAt(anniePosition);
        const endQuaternion = this.camera.quaternion.clone();
        this.camera.quaternion.copy(startQuaternion);

        // Animate the rotation
        const duration = 1000; // 1 second
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

            this.camera.quaternion.slerpQuaternions(startQuaternion, endQuaternion, eased);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete, call callback
                if (onComplete) {
                    onComplete();
                }
            }
        };

        animate();

        // Freeze controls while looking at Annie
        if (this.controls) {
            this.controls.freeze();
        }
    }

    /**
     * Unfreezes the player controls and clears the camera lookAt state.
     */
    stopLookingAtAnnie() {
        // Stop any playing dialogue audio
        this.stopDialogueAudio();

        // Unfreeze controls
        if (this.controls) {
            this.controls.unfreeze();
        }
        this.interactionSystem.originalCameraLookAt = null;
    }
}

export { AnnieInteraction, DialogueNode, DialogueEdge, DialogueTree };