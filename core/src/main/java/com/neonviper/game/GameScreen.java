package com.neonviper.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.PerspectiveCamera;
import com.badlogic.gdx.graphics.VertexAttributes;
import com.badlogic.gdx.graphics.g3d.Environment;
import com.badlogic.gdx.graphics.g3d.Material;
import com.badlogic.gdx.graphics.g3d.Model;
import com.badlogic.gdx.graphics.g3d.ModelInstance;
import com.badlogic.gdx.graphics.g3d.attributes.ColorAttribute;
import com.badlogic.gdx.graphics.g3d.environment.DirectionalLight;
import com.badlogic.gdx.graphics.g3d.utils.ModelBuilder;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.utils.ScreenUtils;

public class GameScreen implements Screen {
    final NeonViperGame game;
    PerspectiveCamera camera;
    Environment environment;
    
    ModelInstance groundInstance;
    ModelInstance headInstance;

    public GameScreen(NeonViperGame game) {
        this.game = game;
        camera = new PerspectiveCamera(67, Gdx.graphics.getWidth(), Gdx.graphics.getHeight());
        camera.position.set(0f, 10f, -15f);
        camera.lookAt(0f, 0f, 0f);
        camera.near = 1f;
        camera.far = 300f;
        camera.update();

        environment = new Environment();
        environment.set(new ColorAttribute(ColorAttribute.AmbientLight, 0.4f, 0.4f, 0.4f, 1f));
        environment.add(new DirectionalLight().set(0.8f, 0.8f, 0.8f, -1f, -0.8f, -0.2f));

        ModelBuilder modelBuilder = new ModelBuilder();
        
        // Ground (Arena)
        Model groundModel = modelBuilder.createCylinder(100f, 0.1f, 100f, 64,
            new Material(ColorAttribute.createDiffuse(new Color(0.04f, 0.09f, 0.19f, 1f))),
            VertexAttributes.Usage.Position | VertexAttributes.Usage.Normal);
        groundInstance = new ModelInstance(groundModel);

        // Snake Head
        Model headModel = modelBuilder.createSphere(2.5f, 2.5f, 2.5f, 32, 32,
            new Material(ColorAttribute.createDiffuse(new Color(0.16f, 1f, 0.69f, 1f))),
            VertexAttributes.Usage.Position | VertexAttributes.Usage.Normal);
        headInstance = new ModelInstance(headModel);
        headInstance.transform.setToTranslation(0, 1.5f, 0);
    }

    @Override
    public void render(float delta) {
        ScreenUtils.clear(0.015f, 0.027f, 0.058f, 1f);
        
        // Camera 360 logic (Slow orbit for testing)
        float angle = (System.currentTimeMillis() % 10000) / 10000f * MathUtils.PI2;
        camera.position.set(MathUtils.sin(angle) * 15f, 10f, MathUtils.cos(angle) * 15f);
        camera.lookAt(0f, 0f, 0f);
        camera.update();

        game.modelBatch.begin(camera);
        game.modelBatch.render(groundInstance, environment);
        game.modelBatch.render(headInstance, environment);
        game.modelBatch.end();
    }

    @Override public void show() {}
    @Override public void resize(int width, int height) {}
    @Override public void pause() {}
    @Override public void resume() {}
    @Override public void hide() {}
    @Override public void dispose() {}
}
