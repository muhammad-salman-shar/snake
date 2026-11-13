package com.neonviper.game;

import com.badlogic.gdx.Game;
import com.badlogic.gdx.graphics.g3d.ModelBatch;

public class NeonViperGame extends Game {
    public ModelBatch modelBatch;

    @Override
    public void create() {
        modelBatch = new ModelBatch();
        setScreen(new GameScreen(this));
    }

    @Override
    public void dispose() {
        modelBatch.dispose();
    }
}
