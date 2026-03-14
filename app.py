import random
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
app.secret_key = "magical-kingdom-quest-dev"


MAGIC_QUESTIONS = [
    {
        "question": "A wizard’s favorite snack is...",
        "options": ["Spell-os cereal", "Broomstick broccoli", "Invisible ice cream", "Potion pickles"],
        "answerIndex": 0,
    },
    {
        "question": "What do you call a dragon who tells jokes?",
        "options": ["A pun-agon", "A giggle-lizard", "A roast-beast", "A fire comedian"],
        "answerIndex": 0,
    },
    {
        "question": "Which door opens with kindness?",
        "options": ["The metal one", "The rude one", "The 'PLEASE' one", "The one that yells"],
        "answerIndex": 2,
    },
    {
        "question": "A fairy’s GPS stands for...",
        "options": ["Glitter Position Sparkles", "Goblin Parking System", "Grand Potion Soup", "Go Please Slowly"],
        "answerIndex": 0,
    },
    {
        "question": "Knights say 'NEIGH!' to impress...",
        "options": ["Horses", "Dragons", "Sandwiches", "Clouds"],
        "answerIndex": 0,
    },
    {
        "question": "To cross the sticky swamp, you should...",
        "options": ["Tiptoe like a ninja", "Somersault loudly", "Argue with mud", "Hug a mosquito"],
        "answerIndex": 0,
    },
    {
        "question": "The Golden Castle’s password is most likely...",
        "options": ["1234", "PLEASEANDTHANKYOU", "I AM A TURNIP", "DRAGONFOOD"],
        "answerIndex": 1,
    },
    {
        "question": "Magic crystals are powered by...",
        "options": ["Moonlight", "Polite clapping", "Unpaid taxes", "Sad trombones"],
        "answerIndex": 0,
    },
]


MAGIC_CARDS = [
    {
        "id": "rocket_boots",
        "name": "Rocket Boots",
        "text": "WHOOSH! Move +3. Try not to trip over your own awesome.",
        "type": "move",
        "value": 3,
    },
    {
        "id": "tiny_wings",
        "name": "Tiny Wings",
        "text": "Flap flap! Move +2 and make bird noises. Mandatory.",
        "type": "move",
        "value": 2,
    },
    {
        "id": "oops_scoot",
        "name": "Oops Scoot",
        "text": "Accidental heroism! Move +1.",
        "type": "move",
        "value": 1,
    },
    {
        "id": "coin_splosion",
        "name": "Coin-splosion!",
        "text": "Coins rain from the sky like shiny popcorn. Gain +2 coins.",
        "type": "coins",
        "value": 2,
    },
    {
        "id": "pocket_change",
        "name": "Pocket Change Gremlin",
        "text": "A gremlin politely returns your lost coin. Gain +1 coin.",
        "type": "coins",
        "value": 1,
    },
    {
        "id": "mystic_ward",
        "name": "Mystic Ward",
        "text": "Bubble-shield! Cancel ONE Trap (stun) when it happens.",
        "type": "item",
        "item": "ward",
    },
    {
        "id": "dragon_shield",
        "name": "Dragon-Proof Shield",
        "text": "Anti-bite technology! Ignore ONE Dragon encounter.",
        "type": "item",
        "item": "shield",
    },
    {
        "id": "reroll_raccoon",
        "name": "Reroll Raccoon",
        "text": "A raccoon steals your dice and brings it back... improved. Reroll once.",
        "type": "item",
        "item": "reroll",
    },
]

@app.route('/')
def index():
    return render_template('index.html')


@app.get("/api/magic-question")
def api_magic_question():
    # optional seed so tests / replays can be deterministic if desired
    seed = request.args.get("seed")
    if seed is not None:
        rnd = random.Random(seed)
        q = rnd.choice(MAGIC_QUESTIONS)
    else:
        q = random.choice(MAGIC_QUESTIONS)
    return jsonify(q)


@app.get("/api/magic-card")
def api_magic_card():
    seed = request.args.get("seed")
    if seed is not None:
        rnd = random.Random(seed)
        card = rnd.choice(MAGIC_CARDS)
    else:
        card = random.choice(MAGIC_CARDS)
    return jsonify(card)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
