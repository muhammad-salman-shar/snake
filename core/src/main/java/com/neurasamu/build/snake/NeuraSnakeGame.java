package com.neurasamu.build.snake;

import com.badlogic.gdx.Game;
import com.badlogic.gdx.graphics.g3d.ModelBatch;

public class NeuraSnakeGame extends Game {
    public ModelBatch modelBatch;

    @Override
    public void create() {
        modelBatch = new ModelBatch();
        setScreen(new GameScreen(this));
    }

    @Override
    public void dispose() {
        if (getScreen() != null) getScreen().dispose();
        modelBatch.dispose();
    }
}
