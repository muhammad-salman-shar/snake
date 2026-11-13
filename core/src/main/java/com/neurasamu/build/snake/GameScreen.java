package com.neurasamu.build.snake;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.Preferences;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.PerspectiveCamera;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.VertexAttributes.Usage;
import com.badlogic.gdx.graphics.g2d.BitmapFont;
import com.badlogic.gdx.graphics.g2d.GlyphLayout;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.g3d.Environment;
import com.badlogic.gdx.graphics.g3d.Material;
import com.badlogic.gdx.graphics.g3d.Model;
import com.badlogic.gdx.graphics.g3d.ModelBatch;
import com.badlogic.gdx.graphics.g3d.ModelInstance;
import com.badlogic.gdx.graphics.g3d.attributes.ColorAttribute;
import com.badlogic.gdx.graphics.g3d.environment.DirectionalLight;
import com.badlogic.gdx.graphics.g3d.utils.ModelBuilder;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.math.Vector3;
import com.badlogic.gdx.utils.Array;
import com.badlogic.gdx.utils.ScreenUtils;

public class GameScreen extends InputAdapter implements Screen {

    private static final float ARENA_RADIUS = 50f;
    private static final float HEAD_RADIUS = 1.3f;
    private static final float SNAKE_Y = 1.05f;
    private static final float BASE_SPEED = 11.2f;
    private static final float MAX_SPEED = 16.5f;
    private static final float BASE_TURN_RATE = 2.45f;
    private static final float SEG_SPACING = 0.86f;
    private static final int START_SEGMENTS = 12;
    private static final int GROW_PER_FOOD = 3;
    private static final float FOOD_RADIUS = 0.95f;
    private static final float CAM_BACK = 14f;
    private static final float CAM_UP = 9.2f;
    private static final float CAM_AHEAD = 6f;
    private static final float CAM_LAG = 6.5f;
    private static final float LOOK_LAG = 9f;
    private static final int TRAIL_MAX = 4000;
    private static final int SEGMENT_POOL = 200;

    private enum Mode { READY, PLAYING, GAMEOVER }

    private Mode mode = Mode.READY;
    private int score = 0;
    private int best = 0;
    private float currentSpeed = BASE_SPEED;
    private float yaw = 0f;
    private float turnInput = 0f;
    private float speedMult = 1f;
    private float sensitivity = 1f;
    private int segmentCount = START_SEGMENTS;
    private final Vector3 headPos = new Vector3(0, SNAKE_Y, 0);
    private final Vector3 lookTarget = new Vector3();
    private float shake = 0f;
    private float gameTime = 0f;
    private float foodX = 0f, foodZ = 0f;
    private float foodPop = 1f;

    private boolean dragging = false;
    private float touchStartX = 0f, touchStartY = 0f;
    private float steerRange = 1f, throttleRange = 1f;

    private final float[] trailX = new float[TRAIL_MAX];
    private final float[] trailZ = new float[TRAIL_MAX];
    private int trailHead = 0;
    private int trailCount = 0;

    private final NeuraSnakeGame game;
    private final ModelBatch modelBatch;
    private PerspectiveCamera camera;
    private Environment environment;
    private SpriteBatch batch;
    private BitmapFont font;
    private BitmapFont bigFont;
    private final GlyphLayout glyph = new GlyphLayout();
    private Texture whitePixel;

    private ModelInstance groundInstance;
    private final Array<ModelInstance> ringInstances = new Array<>();
    private ModelInstance headInstance;
    private ModelInstance foodInstance;
    private final Array<ModelInstance> segments = new Array<>();
    private final Array<Model> models = new Array<>();

    private Preferences prefs;

    public GameScreen(NeuraSnakeGame game) {
        this.game = game;
        this.modelBatch = game.modelBatch;
    }

    @Override
    public void show() {
        Gdx.input.setInputProcessor(this);
        initGraphics();
        resetGame();
    }

    private void initGraphics() {
        prefs = Gdx.app.getPreferences("neura_snake");
        best = prefs.getInteger("best", 0);

        camera = new PerspectiveCamera(60f, Gdx.graphics.getWidth(), Gdx.graphics.getHeight());
        camera.near = 0.1f;
        camera.far = 650f;
        camera.position.set(0, CAM_UP, -CAM_BACK);
        camera.lookAt(0, SNAKE_Y + 1.2f, CAM_AHEAD);
        camera.update();

        environment = new Environment();
        environment.set(new ColorAttribute(ColorAttribute.AmbientLight, 0.45f, 0.45f, 0.55f, 1f));
        environment.add(new DirectionalLight().set(1f, 1f, 1f, -0.5f, -1f, -0.2f));
        environment.add(new DirectionalLight().set(0.9f, 0.2f, 0.6f, 0.8f, -0.6f, 0.5f));

        batch = new SpriteBatch();
        font = new BitmapFont();
        font.getData().setScale(2f);
        bigFont = new BitmapFont();
        bigFont.getData().setScale(5f);

        Pixmap pm = new Pixmap(1, 1, Pixmap.Format.RGBA8888);
        pm.setColor(Color.WHITE);
        pm.fill();
        whitePixel = new Texture(pm);
        pm.dispose();

        steerRange = Gdx.graphics.getWidth() * 0.20f;
        throttleRange = Gdx.graphics.getHeight() * 0.10f;

        ModelBuilder mb = new ModelBuilder();

        Material groundMat = new Material(ColorAttribute.createDiffuse(new Color(0.04f, 0.09f, 0.19f, 1f)));
        Model groundModel = mb.createCylinder(ARENA_RADIUS * 2f, 0.1f, ARENA_RADIUS * 2f, 64,
                groundMat, Usage.Position | Usage.Normal);
        models.add(groundModel);
        groundInstance = new ModelInstance(groundModel);

        Material postMat = new Material(
                ColorAttribute.createDiffuse(new Color(1f, 0.33f, 0.53f, 1f)),
                ColorAttribute.createEmissive(new Color(0.7f, 0.1f, 0.3f, 1f)));
        Model postModel = mb.createBox(0.5f, 3f, 0.5f, postMat,
                Usage.Position | Usage.Normal);
        models.add(postModel);
        int postCount = 90;
        for (int i = 0; i < postCount; i++) {
            float angle = i / (float) postCount * MathUtils.PI2;
            ModelInstance post = new ModelInstance(postModel);
            post.transform.setToTranslation(
                    MathUtils.cos(angle) * ARENA_RADIUS, 1.5f, MathUtils.sin(angle) * ARENA_RADIUS);
            ringInstances.add(post);
        }

        Material headMat = new Material(
                ColorAttribute.createDiffuse(new Color(0.16f, 1f, 0.69f, 1f)),
                ColorAttribute.createEmissive(new Color(0.05f, 0.6f, 0.4f, 1f)));
        Model headModel = mb.createSphere(HEAD_RADIUS * 2f, HEAD_RADIUS * 2f, HEAD_RADIUS * 2f,
                20, 16, headMat, Usage.Position | Usage.Normal);
        models.add(headModel);
        headInstance = new ModelInstance(headModel);
        headInstance.transform.setToTranslation(0, SNAKE_Y, 0);

        Model segModel = mb.createSphere(1f, 1f, 1f, 10, 8,
                new Material(ColorAttribute.createDiffuse(Color.WHITE)),
                Usage.Position | Usage.Normal);
        models.add(segModel);
        for (int i = 0; i < SEGMENT_POOL; i++) {
            ModelInstance mi = new ModelInstance(segModel);
            float hue = 0.42f - (i % 40) * 0.006f;
            Color diffuse = hsvToColor(hue, 0.85f, 0.50f);
            Color emissive = hsvToColor(hue, 0.90f, 0.24f);
            mi.materials.set(0, new Material(
                    ColorAttribute.createDiffuse(diffuse),
                    ColorAttribute.createEmissive(emissive)));
            mi.transform.setToScaling(0.5f, 0.5f, 0.5f);
            mi.transform.setTranslation(0, SNAKE_Y, 1000f);
            segments.add(mi);
        }

        Material foodMat = new Material(
                ColorAttribute.createDiffuse(new Color(1f, 0.82f, 0.40f, 1f)),
                ColorAttribute.createEmissive(new Color(1f, 0.54f, 0f, 1f)));
        Model foodModel = mb.createSphere(FOOD_RADIUS * 2f, FOOD_RADIUS * 2f, FOOD_RADIUS * 2f,
                6, 5, foodMat, Usage.Position | Usage.Normal);
        models.add(foodModel);
        foodInstance = new ModelInstance(foodModel);
        foodInstance.transform.setToTranslation(0, 1.25f, 0);
    }

    private static Color hsvToColor(float h, float s, float v) {
        float r, g, b;
        int i = (int) (h * 6);
        float f = h * 6 - i;
        float p = v * (1 - s);
        float q = v * (1 - f * s);
        float w = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v; g = w; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = w; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = w; g = p; b = v; break;
            default: r = v; g = p; b = q; break;
        }
        return new Color(r, g, b, 1f);
    }

    private void resetGame() {
        yaw = 0f;
        turnInput = 0f;
        speedMult = 1f;
        segmentCount = START_SEGMENTS;
        score = 0;
        currentSpeed = BASE_SPEED;
        headPos.set(0, SNAKE_Y, 0);
        lookTarget.set(0, SNAKE_Y + 1.2f, CAM_AHEAD);
        shake = 0f;
        gameTime = 0f;

        trailHead = 0;
        trailCount = 0;
        float need = segmentCount * SEG_SPACING + 12f;
        int steps = (int) Math.ceil(need / 0.2f);
        for (int i = steps; i >= 0; i--) {
            pushTrail(0f, -i * 0.2f);
        }

        headInstance.transform.idt();
        headInstance.transform.setTranslation(0, SNAKE_Y, 0);

        for (int i = 0; i < segments.size; i++) {
            segments.get(i).transform.setTranslation(0, SNAKE_Y, 1000f);
        }

        snapCamera();
        spawnFood();
        updateBody();
    }

    private void pushTrail(float x, float z) {
        trailX[trailHead] = x;
        trailZ[trailHead] = z;
        trailHead = (trailHead + 1) % TRAIL_MAX;
        if (trailCount < TRAIL_MAX) trailCount++;
    }

    private void snapCamera() {
        float fx = MathUtils.sin(yaw);
        float fz = MathUtils.cos(yaw);
        camera.position.set(headPos.x - fx * CAM_BACK, headPos.y + CAM_UP, headPos.z - fz * CAM_BACK);
        lookTarget.set(headPos.x + fx * CAM_AHEAD, headPos.y + 1.2f, headPos.z + fz * CAM_AHEAD);
        camera.lookAt(lookTarget);
        camera.update();
    }

    private void spawnFood() {
        float maxR = ARENA_RADIUS - 8f;
        for (int t = 0; t < 50; t++) {
            float a = MathUtils.random(MathUtils.PI2);
            float r = (float) Math.sqrt(MathUtils.random()) * maxR;
            float x = MathUtils.cos(a) * r;
            float z = MathUtils.sin(a) * r;
            float d = (float) Math.hypot(x - headPos.x, z - headPos.z);
            if (d > 15f) {
                foodX = x;
                foodZ = z;
                foodPop = 0f;
                return;
            }
        }
        foodX = maxR * 0.5f;
        foodZ = maxR * 0.5f;
        foodPop = 0f;
    }

    private void updateBody() {
        int placed = 0;
        float acc = 0f;
        float target = SEG_SPACING;
        float prevX = headPos.x;
        float prevZ = headPos.z;
        int maxSeg = Math.min(segmentCount, SEGMENT_POOL);

        for (int i = 0; i < trailCount && placed < maxSeg; i++) {
            int idx = (trailHead - 1 - i + TRAIL_MAX * 2) % TRAIL_MAX;
            float px = trailX[idx];
            float pz = trailZ[idx];
            float dx = px - prevX;
            float dz = pz - prevZ;
            float d = (float) Math.hypot(dx, dz);
            if (d > 1e-6f) {
                while (placed < maxSeg && acc + d >= target) {
                    float t = (target - acc) / d;
                    ModelInstance mi = segments.get(placed);
                    float r = Math.max(0.34f, 0.95f - placed * 0.025f) * HEAD_RADIUS;
                    mi.transform.setToScaling(r, r, r);
                    mi.transform.setTranslation(prevX + dx * t, SNAKE_Y, prevZ + dz * t);
                    placed++;
                    target += SEG_SPACING;
                }
                acc += d;
            }
            prevX = px;
            prevZ = pz;
        }

        for (int i = placed; i < segments.size; i++) {
            segments.get(i).transform.setTranslation(0, SNAKE_Y, 1000f);
        }
    }

    @Override
    public void render(float delta) {
        delta = Math.min(delta, 0.05f);
        gameTime += delta;

        update(delta);

        ScreenUtils.clear(0.015f, 0.027f, 0.058f, 1f);

        modelBatch.begin(camera);
        modelBatch.render(groundInstance, environment);
        for (ModelInstance post : ringInstances) modelBatch.render(post, environment);
        modelBatch.render(headInstance, environment);
        modelBatch.render(foodInstance, environment);
        for (int i = 0; i < segments.size; i++) {
            modelBatch.render(segments.get(i), environment);
        }
        modelBatch.end();

        drawHud();
    }

    private void update(float dt) {
        if (mode == Mode.PLAYING && !dragging) {
            float t = 0f;
            if (Gdx.input.isKeyPressed(Input.Keys.LEFT) || Gdx.input.isKeyPressed(Input.Keys.A)) t -= 1f;
            if (Gdx.input.isKeyPressed(Input.Keys.RIGHT) || Gdx.input.isKeyPressed(Input.Keys.D)) t += 1f;
            turnInput = t;
            float s = 1f;
            if (Gdx.input.isKeyPressed(Input.Keys.UP) || Gdx.input.isKeyPressed(Input.Keys.W)) s = 1.85f;
            if (Gdx.input.isKeyPressed(Input.Keys.DOWN) || Gdx.input.isKeyPressed(Input.Keys.S)) s = 0.35f;
            speedMult = s;
        }

        if (mode == Mode.PLAYING) {
            yaw -= turnInput * BASE_TURN_RATE * sensitivity * dt;
            float speedNow = currentSpeed * speedMult;
            float fx = MathUtils.sin(yaw);
            float fz = MathUtils.cos(yaw);
            headPos.x += fx * speedNow * dt;
            headPos.z += fz * speedNow * dt;
            headPos.y = SNAKE_Y;

            pushTrail(headPos.x, headPos.z);
            updateBody();

            float distFromCenter = (float) Math.hypot(headPos.x, headPos.z);
            if (distFromCenter > ARENA_RADIUS - HEAD_RADIUS) {
                onGameOver();
            }

            if (mode == Mode.PLAYING) {
                float fdx = headPos.x - foodX;
                float fdz = headPos.z - foodZ;
                if ((float) Math.hypot(fdx, fdz) < HEAD_RADIUS + FOOD_RADIUS + 0.25f) {
                    onEat();
                }
            }
        }

        headInstance.transform.idt();
        headInstance.transform.translate(headPos.x, headPos.y, headPos.z);
        headInstance.transform.rotate(Vector3.Y, yaw * MathUtils.radiansToDegrees);

        foodPop = Math.min(1f, foodPop + dt * 4.5f);
        float popEase = 1f - (float) Math.pow(1f - foodPop, 3);
        float foodScale = 0.2f + popEase * 0.8f;
        float bob = MathUtils.sin(gameTime * 3.2f) * 0.28f;
        foodInstance.transform.idt();
        foodInstance.transform.translate(foodX, 1.25f + bob, foodZ);
        foodInstance.transform.rotate(Vector3.Y, gameTime * 100f);
        foodInstance.transform.rotate(Vector3.X, gameTime * 60f);
        foodInstance.transform.scale(foodScale, foodScale, foodScale);

        updateCamera(dt);
    }

    private void updateCamera(float dt) {
        float fx = MathUtils.sin(yaw);
        float fz = MathUtils.cos(yaw);
        float dX = headPos.x - fx * CAM_BACK;
        float dY = headPos.y + CAM_UP;
        float dZ = headPos.z - fz * CAM_BACK;
        float kPos = 1f - (float) Math.exp(-CAM_LAG * dt);
        camera.position.x += (dX - camera.position.x) * kPos;
        camera.position.y += (dY - camera.position.y) * kPos;
        camera.position.z += (dZ - camera.position.z) * kPos;

        float tX = headPos.x + fx * CAM_AHEAD;
        float tY = headPos.y + 1.2f;
        float tZ = headPos.z + fz * CAM_AHEAD;
        float kLook = 1f - (float) Math.exp(-LOOK_LAG * dt);
        lookTarget.x += (tX - lookTarget.x) * kLook;
        lookTarget.y += (tY - lookTarget.y) * kLook;
        lookTarget.z += (tZ - lookTarget.z) * kLook;

        float targetFov = 60f + (speedMult - 1f) * 10f;
        camera.fieldOfView += (targetFov - camera.fieldOfView) * (5f * dt);

        camera.lookAt(lookTarget);
        camera.update();

        if (shake > 0f) {
            shake = Math.max(0f, shake - dt * 1.6f);
            float s = shake * shake * 1.6f;
            camera.position.x += (MathUtils.random() - 0.5f) * s;
            camera.position.y += (MathUtils.random() - 0.5f) * s;
            camera.position.z += (MathUtils.random() - 0.5f) * s;
            camera.update();
        }
    }

    private void onEat() {
        score++;
        segmentCount += GROW_PER_FOOD;
        currentSpeed = Math.min(MAX_SPEED, currentSpeed + 0.22f);
        spawnFood();
    }

    private void onGameOver() {
        if (mode != Mode.PLAYING) return;
        mode = Mode.GAMEOVER;
        turnInput = 0f;
        shake = 0.75f;
        if (score > best) {
            best = score;
            prefs.putInteger("best", best);
            prefs.flush();
        }
    }

    private void startGame() {
        resetGame();
        mode = Mode.PLAYING;
    }

    private void drawHud() {
        int sw = Gdx.graphics.getWidth();
        int sh = Gdx.graphics.getHeight();
        batch.begin();

        font.setColor(new Color(0.37f, 0.94f, 0.75f, 1f));
        font.draw(batch, "SCORE", 30, sh - 30);
        font.setColor(Color.WHITE);
        font.draw(batch, String.valueOf(score), 30, sh - 70);

        font.setColor(new Color(0.37f, 0.94f, 0.75f, 1f));
        font.draw(batch, "BEST", 30, sh - 120);
        font.setColor(Color.WHITE);
        font.draw(batch, String.valueOf(best), 30, sh - 160);

        String badge = String.format("%.1fx SPEED", speedMult);
        glyph.setText(font, badge);
        float bw = glyph.width + 40f;
        float bh = glyph.height + 24f;
        float bx = sw - bw - 30f;
        float by = sh - bh - 30f;
        batch.setColor(0.04f, 0.10f, 0.18f, 0.8f);
        batch.draw(whitePixel, bx, by, bw, bh);
        if (speedMult > 1.15f) batch.setColor(0f, 1f, 1f, 1f);
        else if (speedMult < 0.85f) batch.setColor(1f, 0.67f, 0f, 1f);
        else batch.setColor(0.37f, 0.94f, 0.75f, 1f);
        font.setColor(batch.getColor());
        font.draw(batch, badge, bx + 20f, by + bh - 12f);
        batch.setColor(Color.WHITE);

        if (mode == Mode.READY || mode == Mode.GAMEOVER) {
            batch.setColor(0f, 0f, 0f, 0.6f);
            batch.draw(whitePixel, 0, 0, sw, sh);
            batch.setColor(Color.WHITE);

            bigFont.setColor(new Color(0.43f, 1f, 0.82f, 1f));
            String title = mode == Mode.READY ? "NEURA SNAKE" : "GAME OVER";
            if (mode == Mode.GAMEOVER) bigFont.setColor(new Color(1f, 0.36f, 0.48f, 1f));
            glyph.setText(bigFont, title);
            bigFont.draw(batch, title, (sw - glyph.width) / 2f, sh / 2f + 140f);

            font.setColor(Color.WHITE);
            if (mode == Mode.READY) {
                String sub = "TAP TO START";
                glyph.setText(font, sub);
                font.draw(batch, sub, (sw - glyph.width) / 2f, sh / 2f);
                String hint = "Drag to steer  -  Swipe up = boost";
                font.setColor(new Color(0.6f, 0.7f, 0.8f, 1f));
                glyph.setText(font, hint);
                font.draw(batch, hint, (sw - glyph.width) / 2f, sh / 2f - 80f);
            } else {
                String sub = "SCORE  " + score + "      BEST  " + best;
                glyph.setText(font, sub);
                font.draw(batch, sub, (sw - glyph.width) / 2f, sh / 2f);
                String hint = "TAP TO RETRY";
                font.setColor(new Color(0.6f, 0.7f, 0.8f, 1f));
                glyph.setText(font, hint);
                font.draw(batch, hint, (sw - glyph.width) / 2f, sh / 2f - 80f);
            }
        }

        batch.end();
    }

    @Override
    public boolean touchDown(int screenX, int screenY, int pointer, int button) {
        if (mode == Mode.READY || mode == Mode.GAMEOVER) {
            startGame();
            return true;
        }
        if (mode == Mode.PLAYING) {
            dragging = true;
            touchStartX = screenX;
            touchStartY = screenY;
            return true;
        }
        return false;
    }

    @Override
    public boolean touchDragged(int screenX, int screenY, int pointer) {
        if (!dragging || mode != Mode.PLAYING) return false;
        float dx = screenX - touchStartX;
        float dy = screenY - touchStartY;

        float clampedDx = MathUtils.clamp(dx, -steerRange, steerRange);
        turnInput = clampedDx / steerRange;

        if (dy < -throttleRange * 0.15f) {
            float norm = Math.min(1f, Math.abs(dy + throttleRange * 0.15f) / (throttleRange * 0.75f));
            speedMult = 1f + norm * 0.85f;
        } else if (dy > throttleRange * 0.15f) {
            float norm = Math.min(1f, (dy - throttleRange * 0.15f) / (throttleRange * 0.75f));
            speedMult = 1f - norm * 0.65f;
        } else {
            speedMult = 1f;
        }
        return true;
    }

    @Override
    public boolean touchUp(int screenX, int screenY, int pointer, int button) {
        if (dragging) {
            dragging = false;
            turnInput = 0f;
            speedMult = 1f;
            return true;
        }
        return false;
    }

    @Override
    public void resize(int width, int height) {
        camera.viewportWidth = width;
        camera.viewportHeight = height;
        camera.update();
    }

    @Override public void pause() {}
    @Override public void resume() {}
    @Override public void hide() { Gdx.input.setInputProcessor(null); }

    @Override
    public void dispose() {
        if (batch != null) batch.dispose();
        if (font != null) font.dispose();
        if (bigFont != null) bigFont.dispose();
        if (whitePixel != null) whitePixel.dispose();
        for (Model m : models) m.dispose();
        models.clear();
    }
}
