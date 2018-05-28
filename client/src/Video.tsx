
import * as React from 'react';

import { ProjectData } from '../../common/src/types/Project';
import { RouteComponentProps } from 'react-router';

import ProjectsService from './services/Projects';

import YouTube, { } from 'react-youtube';

import { withStyles } from '@material-ui/core/styles';
import { WithStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';

import AnnotationIcon from '@material-ui/icons/Comment';
import PlayIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import FullScreenEnterIcon from '@material-ui/icons/Fullscreen';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';
import EditIcon from '@material-ui/icons/Edit';
import RemoveIcon from '@material-ui/icons/Remove';

import Fullscreen from 'react-full-screen';

import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

import { AnnotationData, AnnotationRecord } from '../../common/src/types/Annotation';
import { formatDuration } from './utils/DurationUtils';
import { MaybeWithTeacher, getTeacherColor } from './types/Teacher';
import Annotation from './Annotation';

interface ProjectParams {
  projectId: string;
}

interface Props extends RouteComponentProps<ProjectParams>, MaybeWithTeacher {

}

enum PlayerState {
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 4
}

const ANNOTATION_TIMEOUT = 5000;

const decorate = withStyles(({ palette, spacing }) => ({
  hintBox: {
    overflowY: 'auto' as 'auto',
    overflowX: 'hidden' as 'scroll',
    height: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute' as 'absolute',
    transition: 'all 0.5s ease',
    bottom: 56,
    width: '100%'
  },
  hint: {
    cursor: 'pointer' as 'pointer',
    opacity: 0,
    position: 'absolute' as 'absolute',
    zIndex: 6,
    top: 0,
    height: 10,
    minWidth: 10,
    margin: 0,
    padding: 0,
    borderRadius: 8,
    backgroundColor: 'white',
    transition: 'all 0.5s ease',
    '&:hover': {
      border: '2px solid white !important'
    }
  },
  videoWrapper: {
    position: 'relative' as 'relative',
    width: '100%',
    paddingBottom: '56.25%',
    backgroundColor: 'black',
  },
  videoIframe: {
    position: 'absolute' as 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 0,
  },
  glassPane: {
    opacity: 0,
    position: 'absolute' as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 0,
    margin: 0,
  },
  annotationFrame: {
    verticalAlign: 'middle' as 'middle',
    textAlign: 'left' as 'left',
    color: 'white',
    position: 'absolute' as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  controlFrame: {
    textAlign: 'left' as 'left',
    color: 'white',
    position: 'absolute' as 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 56,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    transition: 'all 0.5s ease',
    padding: 0
  },
  annotateButton: {
    right: 28,
    bottom: 28,
    transition: 'opacity 0.8s ease',
    position: 'absolute' as 'absolute',
    zIndex: 2
  },
  controls: {
    transition: 'all 0.5s ease',
    width: '100%',
    height: '100%',
    bottom: 0,
    margin: 0,
    padding: 0,
    paddingRight: 130
  },
  icon: {
    height: 32,
    width: 32
  }
}));

interface State {
  annotations: Set<AnnotationRecord>;
  visibleAnnotations: Set<AnnotationRecord>;
  project?: ProjectData;
  error?: string;
  position: number;
  duration: number;
  formattedDuration: string;
  player?: Player;
  fullscreen: boolean;
  playing: boolean;
  userActive: boolean;
  showNav: boolean;
  focusedAnnotation?: string;
  isAddingAnnotation: boolean;
}

interface Player {
  getCurrentTime: Function;
  getDuration: Function;
  playVideo: Function;
  pauseVideo: Function;
  seekTo: Function;
}

const Video = decorate<Props>(
  class extends React.Component<
    Props
    & WithStyles<'controlFrame' | 'annotationFrame' | 'videoIframe' | 'hint' | 'hintBox'
    | 'videoWrapper' | 'videoContainer' | 'controls' | 'icon' | 'glassPane' | 'annotateButton'>,
    State> {
    timeoutId = -1;
    intervalId = -1;
    state = {
      position: 0,
      duration: 0,
      fullscreen: false,
      playing: false,
      userActive: true,
      showNav: false,
      isAddingAnnotation: false,
      annotations: new Set(),
      visibleAnnotations: new Set(),
    } as State;

    timer() {
      const player = this.state.player;
      const position = player ? player.getCurrentTime() : 0;
      const duration = player ? player.getDuration() : 0;
      const annotations = this.state.annotations;
      const visibleAnnotations = new Set(
        Array
          .from(annotations.values())
          .filter(annotation =>
            this.shouldDisplayAnnotation(annotation)
          )
      );
      visibleAnnotations.forEach(annotation => {
        if (annotation.pause
          && !this.state.visibleAnnotations.has(annotation)
          && this.state.player) {
          this.state.player.pauseVideo();
        }
      });
      const state = this.state;
      state.visibleAnnotations = visibleAnnotations;
      state.position = position;
      state.duration = duration;
      this.setState(state);
    }

    resetTimeout() {
      this.setState({
        userActive: true,
      });
      clearInterval(this.timeoutId);
      this.timeoutId = setInterval(this.fadeOutTimer.bind(this), ANNOTATION_TIMEOUT);
    }

    fadeOutTimer() {
      this.setState({
        userActive: false
      });
    }

    seek(value: number) {
      const player = this.state.player;
      if (player) {
        player.seekTo(value);
      }
    }

    shouldDisplayAnnotation(annotation: AnnotationData) {
      return (this.state.position >= annotation.startTime && this.state.position <= annotation.stopTime);
    }

    componentWillUnmount() {
      clearInterval(this.intervalId);
      clearInterval(this.timeoutId);
    }

    getProject() {
      const projectId = this.props.match.params.projectId;

      return ProjectsService.get(projectId)
        .then((project: ProjectData) => {
          this.setState({ project });
          return (ProjectsService.getAnnotations(projectId));
        })
        .then((annotations: AnnotationRecord[]) => {
          this.setState({ annotations: new Set(annotations) });
        })
        .catch((error: Error) => {
          this.setState({ error: error.message });
        });
    }

    componentWillMount() {
      this.getProject();
      this.resetTimeout();
    }

    render() {
      const onMouseMove = this.resetTimeout.bind(this);

      const getAnnotationPosition = (annotation: AnnotationRecord) =>
        `${(annotation.startTime * 100 / this.state.duration)}%`;

      const getAnnotationWidth = (annotation: AnnotationRecord) =>
        `${((annotation.stopTime - annotation.startTime) * 100
          / this.state.duration
        )}%`;

      const videoLoaded = (event: { target: Player }) => {
        const player = event.target;
        this.intervalId = setInterval(this.timer.bind(this), 1000);
        this.setState({ player });
      };

      const videoStateChanged = (event: { target: Player, data: number }) => {
        const state = event.data as PlayerState;
        switch (state) {
          case PlayerState.PLAYING:
          case PlayerState.BUFFERING:
          case PlayerState.CUED:
            this.setState({ playing: true });
            break;
          default:
            this.setState({ playing: false });
        }
      };

      const toggleFullscreen = () => {
        this.setState({ fullscreen: !this.state.fullscreen });
      };

      const togglePlay = () => {
        if (this.state.player) {
          if (this.state.playing) {
            this.state.player.pauseVideo();
          } else {
            this.state.player.playVideo();
          }
        }
      };

      const onClickVideoArea = () => {
        onMouseMove();
        togglePlay();
      };

      const updateCallback = () => {
        this.setState({
          isAddingAnnotation: false
        });
        this.getProject.bind(this);
      };

      const classes = this.props.classes;

      const seek = this.seek.bind(this);

      return (
        <div>
          <Fullscreen
            enabled={this.state.fullscreen}
            onChange={fullscreen => this.setState({ fullscreen })}
          >
            <div
              className={'full-screenable-node'}
              style={{
                height: '100%',
                backgroundColor: 'black',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <div
                className={classes.videoWrapper}
              >
                {this.state.project &&
                  <div>
                    <YouTube
                      videoId={this.state.project.videoId}
                      opts={{
                        playerVars: {
                          modestbranding: 1,
                          rel: 0,
                          start: 0,
                          showinfo: 0,
                          iv_load_policy: 3,
                          controls: 0
                        }
                      }}
                      className={classes.videoIframe}
                      onReady={videoLoaded}
                      onStateChange={videoStateChanged}
                    />
                    <div
                      className={classes.glassPane}
                      onMouseMove={onMouseMove}
                      onClick={onClickVideoArea}
                    />
                    {!this.state.showNav &&
                      <div
                        className={classes.annotationFrame}
                        onMouseMove={onMouseMove}
                      >
                        {Array.from(this.state.visibleAnnotations.values())
                          .map(annotation =>
                            <Annotation
                              teacher={annotation.teacher}
                              key={annotation.id}
                              annotation={annotation}
                              video={{
                                position: this.state.position,
                                duration: this.state.duration
                              }}
                              projectId={this.props.match.params.projectId}
                              updateCallback={updateCallback}
                              seekCallback={seek}
                            />
                          )
                        }
                        {(this.state.isAddingAnnotation && this.props.teacher) &&
                          <Annotation
                            key="new"
                            teacher={{
                              id: this.props.teacher.id,
                              email: this.props.teacher.email,
                              firstName: this.props.teacher.firstName,
                              lastName: this.props.teacher.lastName
                            }}
                            video={{
                              position: this.state.position,
                              duration: this.state.duration
                            }}
                            projectId={this.props.match.params.projectId}
                            updateCallback={updateCallback}
                            seekCallback={seek}
                          />
                        }
                      </div>
                    }
                    {this.props.teacher &&
                      <Button
                        color="secondary"
                        variant="fab"
                        className={classes.annotateButton}
                        style={{
                          opacity: this.state.userActive || this.state.isAddingAnnotation
                            ? 1 : 0
                        }}
                        onClick={() => {
                          this.setState({ isAddingAnnotation: !this.state.isAddingAnnotation });
                        }}
                      >
                        {!this.state.isAddingAnnotation ?
                          <EditIcon /> : <RemoveIcon />
                        }
                      </Button>
                    }
                    <div
                      onMouseMove={onMouseMove}
                      className={classes.hintBox}
                      style={{
                        opacity: this.state.userActive || this.state.showNav ? 1 : 0,
                        height: this.state.showNav ? 'calc(100% - 56px)' : 0
                      }}
                    >
                      <div
                        style={{
                          position: 'relative' as 'relative',
                          margin: 24,
                          height: 'calc(100% - 48px)',
                          width: 'calc(100% - 48px)',
                        }}
                      >
                        {Array.from(this.state.annotations)
                          .map((annotation, index) =>
                            <div
                              key={annotation.id}
                              className={classes.hint}
                              style={{
                                opacity: this.state.showNav ? 1 : 0,
                                top: this.state.showNav ? index * 24 : 0,
                                left: getAnnotationPosition(annotation),
                                width: getAnnotationWidth(annotation),
                                backgroundColor: this.shouldDisplayAnnotation(annotation) ?
                                  'white' :
                                  getTeacherColor(annotation.teacherId),
                                border: `2px solid ${getTeacherColor(annotation.teacherId)}`
                              }}
                              onClick={() => {
                                seek(annotation.startTime);
                                this.timer();
                                this.setState({ showNav: false });
                              }}
                            />
                          )}
                      </div>
                    </div>
                    <div
                      onMouseMove={onMouseMove}
                      className={classes.controlFrame}
                      style={{
                        opacity: this.state.userActive || this.state.showNav ? 1 : 0,
                      }}
                    >
                      <Grid
                        container={true}
                        direction="row"
                        justify="space-between"
                        alignItems="center"
                        className={classes.controls}
                      >
                        <Grid
                          item={true}
                        >
                          <IconButton
                            color="inherit"
                            onClick={togglePlay}
                            classes={{ root: classes.icon }}
                          >
                            {this.state.playing ?
                              <PauseIcon /> :
                              <PlayIcon />
                            }
                          </IconButton>
                        </Grid>
                        <Grid
                          item={true}
                          style={{ flexGrow: 1 }}
                        >
                          <Grid
                            container={true}
                            direction="column"
                          >
                            <Grid
                              item={true}
                              style={{ flexGrow: 1 }}
                            >
                              <Slider
                                min={0}
                                max={this.state.duration}
                                value={this.state.position}
                                trackStyle={[{ backgroundColor: 'orange' }]}
                                handleStyle={[{
                                  borderColor: 'orange'
                                }, {
                                  borderColor: 'orange'
                                }]}
                                onChange={seek}
                                onAfterChange={seek}
                              />
                            </Grid>
                          </Grid>
                        </Grid>
                        <Grid
                          item={true}
                        >
                          <Typography
                            style={{ color: 'white' }}
                            variant="caption"
                          >
                            {`${formatDuration(this.state.position)} / ${formatDuration(this.state.duration)}`}
                          </Typography>
                        </Grid>
                        <Grid
                          item={true}
                        >
                          <IconButton
                            color="inherit"
                            onClick={toggleFullscreen}
                            classes={{ root: classes.icon }}
                          >
                            {this.state.fullscreen ?
                              <FullscreenExitIcon /> :
                              <FullScreenEnterIcon />
                            }
                          </IconButton>
                        </Grid>
                        <Grid
                          item={true}
                        >
                          <IconButton
                            color={this.state.showNav ? 'primary' : 'secondary'}
                            onClick={() => this.setState({ showNav: !this.state.showNav })}
                            classes={{ root: classes.icon }}
                          >
                            <AnnotationIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </div>
                  </div>
                }
              </div>
            </div>
          </Fullscreen>
        </div>
      );
    }
  }
);

export default Video;